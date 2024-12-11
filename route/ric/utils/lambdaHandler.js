const { invokeLambdaFunctionParameters } = require('../../../lambda/lambdaInvocation.js'); // Adjust the path as necessary
const { logInfo } = require('../log/logger.js');

//function to handle the very first request to the server.
async function handleFirstRequest(redisHandler, stateManager, lambdaNode) {
  if (stateManager.get('firstRequest')) {
    const redisKey = stateManager.get('redisKey');
    const redisResponse = await redisHandler.read(redisKey)
    const activeLambdas = Object.entries(redisResponse.ActiveLambdas).filter(
      ([key, value]) => value.isActive
    );
    if (activeLambdas.length === 0) {
      // add lambda node
      const newLambdaNodeKey = await redisHandler.addLambdaNode(redisKey, lambdaNode);
      // call removeLambdaNode to controll the lifetime of a node
      await redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode);
      stateManager.set('firstRequest', false);
    }
  }
}
// invokeWarmLambdaAndDecrementRedis will call the invokeLambdaFunctionParameters
// And decriment the redis after the call.
// It will keep track of the current active nodes.
async function invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey) {
  // get current active nodes
  const engagedLambdas = stateManager.get('engagedLambdas');
  // check the current lambda key is already executing other request
  if (engagedLambdas.includes(lambdaKey)) {
    // if node is busy wait for 10 ms and call invokeWarmLambdaAndDecrementRedis recursively
    return setTimeout(() => invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey), 10);
  }
  // lock the node by pushing lambdaKey to engagedLambdas
  engagedLambdas.push(lambdaKey);
  stateManager.set('engagedLambdas', engagedLambdas);

  try {
    // call lambda and get result
    const lambdaResponse = await invokeLambdaFunctionParameters(targetLambda, req.query, req.body);
    console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
    // update redis by decrimenting the lambda average execution time
    const currentData = await req.redisHandler.update(redisKey, lambdaKey, -lambdaAverageExecutionTime);
    const currentAverage = currentData.ActiveLambdas[lambdaKey].AverageTimeToCompleteExecution;
    // relese the lock from removing key from engagedLambdas
    stateManager.update('engagedLambdas', (list) => list.filter(item => item !== lambdaKey));

    logInfo(`Execution completed for Lambda ${lambdaKey}. Current AverageTimeToCompleteExecution: ${currentAverage}`);
    res.send(lambdaResponse);
  } catch (error) {
    stateManager.update('engagedLambdas', (list) => list.filter(item => item !== lambdaKey));
    console.error('Error during execution:', error);
    res.status(500).json({ error: 'Error during execution.' });
  }
}

// This function is for invoking the lambda
async function invokeLambda(req, stateManager, lambdaKey, minLambdaValue, res, routerState) {
  //get the target lambda to invoke
  const targetLambda = minLambdaValue.targetLambda;
  // get redis key and lambda average execution time from state manager
  const redisKey = stateManager.get('redisKey');
  const lambdaAverageExecutionTime = stateManager.get('lambdaAverageExecutionTime');
  await req.redisHandler.update(redisKey, lambdaKey, lambdaAverageExecutionTime);
  //release the lock for redis read
  stateManager.set('lockRead',false)

  logInfo(
    `From Lambda ${lambdaKey}, AverageTimeToCompleteExecution incremented by: ${lambdaAverageExecutionTime}
    and current AverageTimeToCompleteExecution is: ${minLambdaValue.AverageTimeToCompleteExecution + lambdaAverageExecutionTime}`
  );
  // call invokeWarmLambdaAndDecrementRedis for lambda invocation and followed redis update
  await invokeWarmLambdaAndDecrementRedis(req, res, lambdaKey, targetLambda, stateManager, lambdaAverageExecutionTime, redisKey)
}
// call lambda direct function is for calling lambda and adding a new node. 
// This will be called when current node is overflowed
async function callLambdaDirectAndUpdateRedis(req, res, redisKey, minLambdaValue, lambdaNode){
  const targetLambda = minLambdaValue.targetLambda;
  // directly call lambda
  const lambdaResponse = await invokeLambdaFunctionParameters(targetLambda, req.query, req.body);
  console.log(`Lambda invoked and responded: ${JSON.stringify(lambdaResponse)}`);
  // add new active node to redis
  const newLambdaNodeKey = await req.redisHandler.addLambdaNode(redisKey, lambdaNode)
  // handle newly added redis
  req.redisHandler.removeLambdaNode(redisKey, newLambdaNodeKey, lambdaNode)
  res.send(lambdaResponse);
}
module.exports = { handleFirstRequest, invokeLambda, callLambdaDirectAndUpdateRedis};
