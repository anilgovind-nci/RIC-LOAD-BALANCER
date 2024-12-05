const { invokeLambdaFunctionWithQueryParams } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary
const { logError, logInfo } = require('../log/logger.js');

async function handleFirstRequest(redisHandler, stateManager, lambdaNode) {
  if (stateManager.get('firstRequest')) {
    const redisKey = stateManager.get('redisKey');
    const redisResponse = await redisHandler.read(redisKey)
    const activeLambdas = Object.entries(redisResponse.ActiveLambdas).filter(
      ([key, value]) => value.isActive
    );
    if (activeLambdas.length === 0) {
      const newLambdaNodeKey = await redisHandler.addLambdaNode(redisKey, lambdaNode);
      await redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode);
      stateManager.set('firstRequest', false);
    }
  }
}

async function invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey) {
  const engagedLambdas = stateManager.get('engagedLambdas');

  if (engagedLambdas.includes(lambdaKey)) {
    // console.log('Another request is being processed. Waiting...');
    return setTimeout(() => invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey), 10);
  }

  engagedLambdas.push(lambdaKey);
  stateManager.set('engagedLambdas', engagedLambdas);

  try {
    const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query, req.body);
    console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);

    const currentData = await req.redisHandler.update(redisKey, lambdaKey, -lambdaAverageExecutionTime);
    const currentAverage = currentData.ActiveLambdas[lambdaKey].AverageTimeToCompleteExecution;

    stateManager.update('engagedLambdas', (list) => list.filter(item => item !== lambdaKey));

    logInfo(`Execution completed for Lambda ${lambdaKey}. Current AverageTimeToCompleteExecution: ${currentAverage}`);
    res.send(lambdaResponse);
  } catch (error) {
    stateManager.update('engagedLambdas', (list) => list.filter(item => item !== lambdaKey));
    console.error('Error during execution:', error);
    res.status(500).json({ error: 'Error during execution.' });
  }
}

async function invokeLambda(req, stateManager, lambdaKey, minLambdaValue, res, routerState) {
  const targetLambda = minLambdaValue.targetLambda;
  // const engagedLambdas = stateManager.get('engagedLambdas');
  const redisKey = stateManager.get('redisKey');
  const lambdaAverageExecutionTime = stateManager.get('lambdaAverageExecutionTime');
  await req.redisHandler.update(redisKey, lambdaKey, lambdaAverageExecutionTime);
  stateManager.set('lockRead',false)

  logInfo(
    `From Lambda ${lambdaKey}, AverageTimeToCompleteExecution incremented by: ${lambdaAverageExecutionTime}
    and current AverageTimeToCompleteExecution is: ${minLambdaValue.AverageTimeToCompleteExecution + lambdaAverageExecutionTime}`
  );
  await invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey)
}
async function callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue, lambdaNode){
  const targetLambda = minLambdaValue.targetLambda;
  const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query, req.body);
  console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
  const newLambdaNodeKey = await req.redisHandler.addLambdaNode(redisKey, lambdaNode)
  req.redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode)
  res.send(lambdaResponse);
}
module.exports = { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis};
