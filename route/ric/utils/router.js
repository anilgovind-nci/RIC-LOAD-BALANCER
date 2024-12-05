const { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis } = require('./lambdaHandler.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js');
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');
async function readRedisWithRetry(redisHandler, redisKey, routerState) {
  while (routerState.get('lockRead')) {
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for 10ms
  }
  return await redisHandler.read(redisKey);
}

async function router(req, res, routerState, lambdaNode) {
  try {
    const redisHandler = req.redisHandler;
    const redisKey = redisHandler.RedisSecretDetails[routerState.get('secretManagerKey')]
    routerState.set('redisKey',redisKey)
    await handleFirstRequest(redisHandler, routerState, lambdaNode);
    
    const redisResponse = await readRedisWithRetry(redisHandler, redisKey, routerState);
    routerState.set('lockRead',true)

    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);
    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }

    const activeLambdas = validatedResponse;
    routerState.set('lambdaAverageExecutionTime', redisResponse.lambdaAverageExecutionTime);

    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);
    console.log("current time for execution")
    console.log((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime)
    if ((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime) {
      console.log("lambda executed direct")
      const lambdaResponse = await callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue, lambdaNode);
      res.send(lambdaResponse);
    } else {
      await invokeLambda(req, routerState, minLambdaKey, minLambdaValue, res);
    }
  } catch (error) {
    console.error('Error in Router:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
module.exports = {router };
