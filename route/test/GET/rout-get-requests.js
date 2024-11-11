const Config = require("serverless/lib/classes/config");
const { lambdaAverageColdStartTime, lambdaAverageExecutionTime } = require('./config');
const { logError, logInfo } = require('./logger');

const globalState = {
    LambdaOne: {
        targetLambda: "lambda1",
        AverageTimeToCompleteExecution: 0,
        isActive: true, 
    },
    LambdaTwo: {
        targetLambda: "lambda2",
        AverageTimeToCompleteExecution: 0,
        isActive: true, 
    },
};


function getRouter(req, res) {
    const activeLambdas = Object.entries(globalState)
    .filter(([key, value]) => value.isActive);

    const [minLambdaKey, minLambdaValue] = activeLambdas.reduce((min, current) => {
    const [, currentValue] = current;
    return currentValue.AverageTimeToCompleteExecution < min[1].AverageTimeToCompleteExecution
        ? current
        : min;
    });
    if (minLambdaValue.targetLambda==="lambda1"){
        return warm_lambda_one(req, res, minLambdaValue.AverageTimeToCompleteExecution);
    }
    if (minLambdaValue.targetLambda==="lambda2"){
        return warm_lambda_two(req, res, minLambdaValue.AverageTimeToCompleteExecution);
    }
    else return warm_lambda_one(req, res, minLambdaValue.AverageTimeToCompleteExecution);
}

function warm_lambda_one(req, res, averageTime) {
    globalState.LambdaOne.AverageTimeToCompleteExecution += lambdaAverageExecutionTime;

    setTimeout(() => {
        logInfo("from lambda one, now LambdaOne AverageTimeToCompleteExecution is:"+
            averageTime);
        res.send("message from warm lambda one");

        globalState.LambdaOne.AverageTimeToCompleteExecution -= lambdaAverageExecutionTime;
    }, 5000); 
}

function warm_lambda_two(req, res, averageTime) {
    globalState.LambdaTwo.AverageTimeToCompleteExecution += lambdaAverageExecutionTime;

    setTimeout(() => {
        logInfo("from lambda two, now LambdaTwo AverageTimeToCompleteExecution is:"+
            averageTime);       
        res.send("message from warm lambda two");

        globalState.LambdaTwo.AverageTimeToCompleteExecution -= lambdaAverageExecutionTime;
    }, 5000); 
}

module.exports = getRouter;
