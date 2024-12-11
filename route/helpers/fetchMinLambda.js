//function for fetching minimum load node from redis returned active lambdas
function getLambdaWithMinExecutionTime(lambdas) {
    return lambdas.reduce((min, current) => {
      const [, currentValue] = current;
      const [, minValue] = min;
      return currentValue.AverageTimeToCompleteExecution < minValue.AverageTimeToCompleteExecution
        ? current
        : min;
    }, lambdas[0]);
  }

module.exports = { getLambdaWithMinExecutionTime };