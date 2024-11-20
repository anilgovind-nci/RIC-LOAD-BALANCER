const { logError, logInfo } = require('./logger');

let Lambdas;
let lambdaAverageExecutionTime;
let getLambdaDetailskey = "getLambdaDetailskey";

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
    const timeoutForExecution = minLambdaValue.AverageTimeToCompleteExecution * 1000;  // Convert to milliseconds
    console.log("timeoutForExecution",timeoutForExecution)
    
    // Simulate Lambda execution with a delay based on the calculated timeout
    setTimeout(() => decrementExecutionTimeAndRespond(req, res, minLambdaKey), timeoutForExecution);
  } catch (error) {
    console.error("Error in invoke_warm_lambda:", error);
    res.status(500).json({ error: "Internal server error." });
  }
}


// New function to handle the delayed execution logic
async function decrementExecutionTimeAndRespond(req, res, minLambdaKey) {
  try {
    // Wait for 4 seconds before continuing with the logic
    await new Promise(resolve => setTimeout(resolve, 4000)); // 4000 ms = 4 seconds

    // Decrement the AverageTimeToCompleteExecution after execution
    const currentData = await req.redisHandler.update(getLambdaDetailskey, minLambdaKey, -lambdaAverageExecutionTime);
    const currentAverageTimeToCompleteExecution = currentData.ActiveLambdas[minLambdaKey].AverageTimeToCompleteExecution;

    logInfo(
      `Execution completed for Lambda ${minLambdaKey}. Decremented AverageTimeToCompleteExecution by: ${lambdaAverageExecutionTime}
      and current AverageTimeToCompleteExecution is: ${currentAverageTimeToCompleteExecution}`
    );

    // Send the final response back to the client
    res.send(`Execution completed for warm ${minLambdaKey}.`);
  } catch (timeoutError) {
    console.error("Error during delayed execution:", timeoutError);
    res.status(500).json({ error: "Error during delayed execution." });
  }
}


module.exports = getRouter;
