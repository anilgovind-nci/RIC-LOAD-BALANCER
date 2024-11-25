const { invokeLambdaFunctionWithQueryParams } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary

async function handleFirstRequest(redisHandler, stateManager, lambdaNode) {
  if (stateManager.get('firstRequest')) {
    const redisKey = stateManager.get('redisKey');
    const newLambdaNodeKey = await redisHandler.addLambdaNode(redisKey, lambdaNode);
    await redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode);
    stateManager.set('firstRequest', false);
  }
}

async function invokeLambda(req, redisHandler, stateManager, lambdaKey, targetLambda, res) {
  const engagedLambdas = stateManager.get('engagedLambdas');
  const redisKey = stateManager.get('redisKey');
  const lambdaAverageExecutionTime = stateManager.get('lambdaAverageExecutionTime');

  if (engagedLambdas.includes(lambdaKey)) {
    console.log('Another request is being processed. Waiting...');
    return setTimeout(() => invokeLambda(req, redisHandler, stateManager, lambdaKey, targetLambda, res), 10);
  }

  engagedLambdas.push(lambdaKey);
  stateManager.set('engagedLambdas', engagedLambdas);

  try {
    const lambdaResponse = await invokeLambdaFunctionWithQueryParams(targetLambda, req.query);
    console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
    
    const currentData = await redisHandler.update(redisKey, lambdaKey, -lambdaAverageExecutionTime);
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

module.exports = { handleFirstRequest, invokeLambda };
