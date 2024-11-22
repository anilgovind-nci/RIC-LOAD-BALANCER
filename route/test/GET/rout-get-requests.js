const { logError, logInfo } = require('./logger');
const { invokeLambdaFunctionWithQueryParams } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js')

// let Lambdas;
let lambdaAverageExecutionTime;
let getFunctionResourcesRediskey = "getLambdaDetailskey";
let engagedLambdas = [];


// Main function
async function getRouter(req, res) {
  try {
    const redisHandler = req.redisHandler;
    const redisResponse = await redisHandler.read(getFunctionResourcesRediskey);
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);
    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }
    const activeLambdas = validatedResponse;
    lambdaAverageExecutionTime = redisResponse.lambdaAverageExecutionTime;
    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);
    return invokeWarmLambdaAndIncrementRedis(req, res, minLambdaKey, minLambdaValue);
  } catch (error) {
    console.error("Error in getRouter:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function invokeWarmLambdaAndIncrementRedis(req, res, minLambdaKey, minLambdaValue) {
  try {
    // Increment the AverageTimeToCompleteExecution for the selected Lambda
    await req.redisHandler.update(getFunctionResourcesRediskey, minLambdaKey, lambdaAverageExecutionTime);
    logInfo(
      `From Lambda ${minLambdaKey}, AverageTimeToCompleteExecution incremented by: ${lambdaAverageExecutionTime}
      and current AverageTimeToCompleteExecution is: ${minLambdaValue.AverageTimeToCompleteExecution + lambdaAverageExecutionTime}`
    );
    let targetLambda = minLambdaValue.targetLambda;
    invokeWarmLambdaAndDecrementRedis(req, res, minLambdaKey,targetLambda)
  } catch (error) {
    console.error("Error in invokeWarmLambdaAndIncrementRedis:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function invokeWarmLambdaAndDecrementRedis(req, res, minLambdaKey, targetLambda) {
  try {
    if (engagedLambdas.includes(minLambdaKey)) {
      console.log('Another request is being processed. Waiting...');
      return setTimeout(() => invokeWarmLambdaAndDecrementRedis(req, res, minLambdaKey, targetLambda), 10); // Retry after 10ms
    }
    engagedLambdas.push(minLambdaKey);
    const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query);
    console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
    // Decrement the AverageTimeToCompleteExecution after execution
    const currentData = await req.redisHandler.update(getFunctionResourcesRediskey, minLambdaKey, -lambdaAverageExecutionTime);
    const currentAverageTimeToCompleteExecution = currentData.ActiveLambdas[minLambdaKey].AverageTimeToCompleteExecution;
    engagedLambdas = engagedLambdas.filter(item => item !== minLambdaKey);
    logInfo(
      `Execution completed for Lambda ${minLambdaKey}. Decremented AverageTimeToCompleteExecution by: ${lambdaAverageExecutionTime}
      and current AverageTimeToCompleteExecution is: ${currentAverageTimeToCompleteExecution}`
    );
    res.send(lambdaResponse);
  } catch (error) {
    console.error("Error during execution:", error);
    res.status(500).json({ error: "Error during execution." });
  }
}
module.exports = getRouter;
