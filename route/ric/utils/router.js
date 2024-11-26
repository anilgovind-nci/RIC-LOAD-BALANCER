const { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis } = require('./lambdaHandler.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js');
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');

async function router(req, res, routerState, lambdaNode) {
  try {
    // console.log("request body",req.body)
    const redisHandler = req.redisHandler;
    const redisKey = redisHandler.RedisSecretDetails[routerState.get('secretManagerKey')]
    routerState.set('redisKey',redisKey)
    await handleFirstRequest(redisHandler, routerState, lambdaNode);
    // const redisKey = routerState.get('redisKey');
    const redisResponse = await redisHandler.read(redisKey);
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);

    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }

    const activeLambdas = validatedResponse;
    routerState.set('lambdaAverageExecutionTime', redisResponse.lambdaAverageExecutionTime);

    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);

    if ((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime) {
      const lambdaResponse = await callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue);
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
