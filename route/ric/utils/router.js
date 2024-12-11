const { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis } = require('./lambdaHandler.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js');
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');

// redis read blocking recursive function
async function readRedisWithRetry(redisHandler, redisKey, routerState) {
  // check whether the redis read is locked or not.
  while (routerState.get('lockRead')) {
      // retry readRedisWithRetry after 10ms
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for 10ms
  }
  return await redisHandler.read(redisKey);
}
// top level function to handle the request
async function router(req, res, routerState, lambdaNode) {
  try {
    const redisHandler = req.redisHandler;
    //get redis secret key from redisHandler data
    const redisKey = redisHandler.RedisSecretDetails[routerState.get('secretManagerKey')]
    routerState.set('redisKey',redisKey)
    // call handleFirstRequest to handle the first request.
    await handleFirstRequest(redisHandler, routerState, lambdaNode);

    // execute redis read lock recursive function
    const redisResponse = await readRedisWithRetry(redisHandler, redisKey, routerState);
    // set redis read lock
    routerState.set('lockRead',true)
    // validate redis response and get active lambdas
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);
    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }
    const activeLambdas = validatedResponse;
    // set new lambdaAverageExecutionTime from redis response to routerState
    routerState.set('lambdaAverageExecutionTime', redisResponse.lambdaAverageExecutionTime);
    // minimum key and value from the redis returned activeLambdas
    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);

    // console.log("current time for execution")
    // console.log((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime)

    //check whether the node will overflow or not
    if ((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime) {
      console.log("lambda executed direct")
      //call lambda direct and add node to redis
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
