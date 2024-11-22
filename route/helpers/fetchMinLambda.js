function getLambdaWithMinExecutionTime(lambdas) {
    return lambdas.reduce((min, current) => {
      const [, currentValue] = current;
      const [, minValue] = min;
      return currentValue.AverageTimeToCompleteExecution < minValue.AverageTimeToCompleteExecution
        ? current
        : min;
    }, lambdas[0]); // Set the initial value for reduce
  }

module.exports = { getLambdaWithMinExecutionTime };