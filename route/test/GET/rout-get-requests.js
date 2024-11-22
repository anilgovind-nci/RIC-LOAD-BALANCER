const { logError, logInfo } = require('./logger');
const { invokeLambdaFunctionWithQueryParams } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js')

// let Lambdas;
let lambdaAverageExecutionTime;
let getLambdaDetailskey = "getLambdaDetailskey";
let engagedLambdas = [];


// Main function
async function getRouter(req, res) {
  try {
    const redisHandler = req.redisHandler;
    const redisResponse = await redisHandler.read(getLambdaDetailskey);
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);
    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }
    const activeLambdas = validatedResponse;
    lambdaAverageExecutionTime = redisResponse.lambdaAverageExecutionTime;
    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);
    return invoke_warm_lambda(req, res, minLambdaKey, minLambdaValue);
  } catch (error) {
    console.error("Error in getRouter:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function invoke_warm_lambda(req, res, minLambdaKey, minLambdaValue) {
  try {
    // Increment the AverageTimeToCompleteExecution for the selected Lambda
    await req.redisHandler.update(getLambdaDetailskey, minLambdaKey, lambdaAverageExecutionTime);

    logInfo(
      `From Lambda ${minLambdaKey}, AverageTimeToCompleteExecution incremented by: ${lambdaAverageExecutionTime}
      and current AverageTimeToCompleteExecution is: ${minLambdaValue.AverageTimeToCompleteExecution + lambdaAverageExecutionTime}`
    );
    
    // Set a dynamic timeout based on the lambda's AverageTimeToCompleteExecution (converted to milliseconds)
    const timeoutForExecution = minLambdaValue.AverageTimeToCompleteExecution;  // Convert to milliseconds
    console.log("timeoutForExecution",timeoutForExecution)
    let targetLambda = minLambdaValue.targetLambda;
    // Simulate Lambda execution with a delay based on the calculated timeout


    // setTimeout(() => decrementExecutionTimeAndRespond(req, res, minLambdaKey,targetLambda), timeoutForExecution);
    decrementExecutionTimeAndRespond(req, res, minLambdaKey,targetLambda)

  } catch (error) {
    console.error("Error in invoke_warm_lambda:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}

async function decrementExecutionTimeAndRespond(req, res, minLambdaKey, targetLambda) {
  try {
    // Log the request query parameters and body
    console.log("Request Query Params:", req.query);
    // console.log("Request:", req);

    if (engagedLambdas.includes(minLambdaKey)) {
      console.log('Another request is being processed. Waiting...');
      return setTimeout(() => decrementExecutionTimeAndRespond(req, res, minLambdaKey, targetLambda), 10); // Retry after 10ms
    }
    engagedLambdas.push(minLambdaKey);
    const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query);

    console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
    // Decrement the AverageTimeToCompleteExecution after execution
    const currentData = await req.redisHandler.update(getLambdaDetailskey, minLambdaKey, -lambdaAverageExecutionTime);
    const currentAverageTimeToCompleteExecution = currentData.ActiveLambdas[minLambdaKey].AverageTimeToCompleteExecution;
    engagedLambdas = engagedLambdas.filter(item => item !== minLambdaKey);
    logInfo(
      `Execution completed for Lambda ${minLambdaKey}. Decremented AverageTimeToCompleteExecution by: ${lambdaAverageExecutionTime}
      and current AverageTimeToCompleteExecution is: ${currentAverageTimeToCompleteExecution}`
    );

    // Send the final response back to the client
    res.send(lambdaResponse);
  } catch (error) {
    console.error("Error during execution:", error);
    res.status(500).json({ error: "Error during execution." });
  }
}




module.exports = getRouter;
