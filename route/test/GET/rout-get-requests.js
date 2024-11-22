const { logError, logInfo } = require('./logger');
const { invokeLambdaFunctionWithQueryParams } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary

let Lambdas;
let lambdaAverageExecutionTime;
let getLambdaDetailskey = "getLambdaDetailskey";
let engagedLambdas = [];

async function getRouter(req, res) {
  try {
    const redisHandler = req.redisHandler;

    // Wait for Redis to return the data
    const redisResponse = await redisHandler.read(getLambdaDetailskey);
    Lambdas = redisResponse.ActiveLambdas;
    lambdaAverageExecutionTime = redisResponse.lambdaAverageExecutionTime;

    // Ensure that Lambdas data exists and is in the expected format
    if (!Lambdas) {
      return res.status(404).json({ error: "Lambda details not found." });
    }

    // Filter the active Lambdas
    const activeLambdas = Object.entries(Lambdas).filter(([key, value]) => value.isActive);

    // If no active lambdas are found
    if (activeLambdas.length === 0) {
      return res.status(404).json({ error: "No active Lambdas found." });
    }

    // Find the lambda with the minimum AverageTimeToCompleteExecution
    const [minLambdaKey, minLambdaValue] = activeLambdas.reduce(
      (min, current) => {
        const [, currentValue] = current;
        const [, minValue] = min;
        return currentValue.AverageTimeToCompleteExecution < minValue.AverageTimeToCompleteExecution
          ? current
          : min;
      },
      activeLambdas[0] // Set the initial value for reduce
    );

    // Set a timeout before invoking the lambda based on AverageTimeToCompleteExecution
    // const timeoutForLambdaCall = minLambdaValue.AverageTimeToCompleteExecution*1000;
    // console.log("timeoutForLambdaCall",minLambdaKey, timeoutForLambdaCall);
    // setTimeout(() => {
      return invoke_warm_lambda(req, res, minLambdaKey, minLambdaValue);
    // }, timeoutForLambdaCall);

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
    // const id = "75"; // Replace or adjust based on your use case
    // const pps = "999"; // Replace or adjust based on your use case

    // console.log(`Invoking Lambda ${targetLambda} with query parameters id=${id}, pps=${pps}`);
    
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
