const { postRouterState } = require('../../utils/stateManager.js');
const { handleFirstRequest, invokeLambda } = require('../../utils/lambdaHandler.js');
const { validateRedisResponseAndReturnActiveLambdas } = require('../../helpers/validateRedisResponseAndReturnActiveLambdas.js');
const { getLambdaWithMinExecutionTime } = require('../../helpers/fetchMinLambda.js');
const { lambdaNode } = require('./config.js');

async function getRouter(req, res) {
  try {
    const redisHandler = req.redisHandler;

    await handleFirstRequest(redisHandler, postRouterState, lambdaNode);

    const redisKey = postRouterState.get('redisKey');
    const redisResponse = await redisHandler.read(redisKey);
    const validatedResponse = validateRedisResponseAndReturnActiveLambdas(redisResponse);

    if (validatedResponse.error) {
      return res.status(validatedResponse.error.status).json({ error: validatedResponse.error.message });
    }

    const activeLambdas = validatedResponse;
    postRouterState.set('lambdaAverageExecutionTime', redisResponse.lambdaAverageExecutionTime);

    const [minLambdaKey, minLambdaValue] = getLambdaWithMinExecutionTime(activeLambdas);

    if ((minLambdaValue.AverageTimeToCompleteExecution + redisResponse.lambdaAverageExecutionTime) > redisResponse.lambdaAverageColdStartTime) {
      const lambdaResponse = await invokeLambdaFunctionWithQueryParams(minLambdaValue.targetLambda, req.query);
      res.send(lambdaResponse);
    } else {
      await invokeLambda(req, redisHandler, postRouterState, minLambdaKey, minLambdaValue.targetLambda, res);
    }
  } catch (error) {
    console.error('Error in getRouter:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = getRouter;
