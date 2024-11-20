//const Config = require('serverless');
// const { lambdaAverageColdStartTime, lambdaAverageExecutionTime } = require('./config');
const { logError, logInfo } = require('./logger');
let Lambdas
let lambdaAverageExecutionTime
let getLambdaDetailskey = "getLambdaDetailskey"


async function getRouter(req, res) {
    try {
      const redisHandler = req.redisHandler;
      
      // Wait for Redis to return the data
      const redisResponse = await redisHandler.read(getLambdaDetailskey);
      Lambdas= redisResponse.ActiveLambdas
      lambdaAverageExecutionTime = redisResponse.lambdaAverageExecutionTime
      
      
      // Ensure that Lambdas data exists and is in the expected format
      if (!Lambdas) {
        return res.status(404).json({ error: "Lambda details not found." });
      }
  
      // Filter the active Lambdas
      const activeLambdas = Object.entries(Lambdas)
        .filter(([key, value]) => value.isActive);
  
      // If no active lambdas are found
      if (activeLambdas.length === 0) {
        return res.status(404).json({ error: "No active Lambdas found." });
      }
  
      // Find the lambda with the minimum AverageTimeToCompleteExecution
      const [minLambdaKey, minLambdaValue] = activeLambdas.reduce((min, current) => {
        const [, currentValue] = current;
        return currentValue.AverageTimeToCompleteExecution < min[1].AverageTimeToCompleteExecution
          ? current
          : min;
      });
  
      // Based on the minLambdaValue targetLambda, call the appropriate function
      if (minLambdaValue.targetLambda === "lambda1") {
        return warm_lambda_one(req, res, redisResponse, minLambdaValue.AverageTimeToCompleteExecution);
      }
      if (minLambdaValue.targetLambda === "lambda2") {
        return warm_lambda_two(req, res, redisResponse, minLambdaValue.AverageTimeToCompleteExecution);
      } else {
        return warm_lambda_one(req, res, redisResponse, minLambdaValue.AverageTimeToCompleteExecution);
      }
    } catch (error) {
      console.error("Error in getRouter:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }
  

async function warm_lambda_one(req, res, redisResponse, averageTime) {
  // console.log(redisResponse)
  let updatedRedisResponse = redisResponse.ActiveLambdas.LambdaOne.AverageTimeToCompleteExecution += lambdaAverageExecutionTime;
  await req.redisHandler.update(getLambdaDetailskey,updatedRedisResponse);
    setTimeout(async () => {
        logInfo("from lambda one, now LambdaOne AverageTimeToCompleteExecution is:"+
            averageTime);
        res.send("message from warm lambda one");

        updatedRedisResponse = redisResponse.ActiveLambdas.LambdaOne.AverageTimeToCompleteExecution -= lambdaAverageExecutionTime;
        await req.redisHandler.update(getLambdaDetailskey,updatedRedisResponse);
    }, 5000); 
}

async function warm_lambda_two(req, res, redisResponse, averageTime) {
  let updatedRedisResponse = redisResponse.ActiveLambdas.LambdaTwo.AverageTimeToCompleteExecution += lambdaAverageExecutionTime;
  await req.redisHandler.update(getLambdaDetailskey,updatedRedisResponse);
    Lambdas.LambdaTwo.AverageTimeToCompleteExecution += lambdaAverageExecutionTime;

    setTimeout(async () => {
        logInfo("from lambda two, now LambdaTwo AverageTimeToCompleteExecution is:"+
            averageTime);       
        res.send("message from warm lambda two");

        updatedRedisResponse = redisResponse.ActiveLambdas.LambdaTwo.AverageTimeToCompleteExecution -= lambdaAverageExecutionTime;
        await req.redisHandler.update(getLambdaDetailskey,updatedRedisResponse);
    }, 5000); 
}

module.exports = getRouter;
