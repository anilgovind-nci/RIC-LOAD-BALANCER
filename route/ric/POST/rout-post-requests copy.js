const { postRouterState } = require('../utils/stateManager.js');
const { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis } = require('../utils/lambdaHandler.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js');
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');
const { lambdaNode } = require('./config.js');

async function postRouter(req, res) {
  try {
    // console.log("request body",req.body)
    const redisHandler = req.redisHandler;
    const redisKey = redisHandler.RedisSecretDetails[postRouterState.get('secretManagerKey')]
    postRouterState.set('redisKey',redisKey)
    await handleFirstRequest(redisHandler, postRouterState, lambdaNode);
    // const redisKey = postRouterState.get('redisKey');
    const redisResponse = await redisHandler.read(redisKey);
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);

    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }

    const activeLambdas = validatedResponse;
    postRouterState.set('lambdaAverageExecutionTime', redisResponse.lambdaAverageExecutionTime);

    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);

    if ((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime) {
      const lambdaResponse = await callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue);
      res.send(lambdaResponse);
    } else {
      await invokeLambda(req, postRouterState, minLambdaKey, minLambdaValue, res);
    }
  } catch (error) {
    console.error('Error in getRouter:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}
// async function callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue){
//   const targetLambda = minLambdaValue.targetLambda;
//   const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query, req.body);
//   console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
//   const newLambdaNodeKey = await req.redisHandler.addLambdaNode(redisKey, lambdaNode)
//   req.redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode)
//   res.send(lambdaResponse);
// }
module.exports = postRouter;
