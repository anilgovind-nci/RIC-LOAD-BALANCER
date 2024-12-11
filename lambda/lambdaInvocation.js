const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// Create a Lambda client for hitting the CRUD functions
const lambdaClient = new LambdaClient({ region: "eu-west-1" });

// Function to invoke the Lambda with parameters
async function invokeLambdaFunctionParameters(functionName, queryParameters, requestBody) {
  const params = {
    FunctionName: functionName,
    InvocationType: "RequestResponse",
    Payload: JSON.stringify({
      queryStringParameters: queryParameters,
      body: JSON.stringify(requestBody)
    }),
  };

  try {
    // Invoke the Lambda function with parameters
    const command = new InvokeCommand(params);
    const response = await lambdaClient.send(command);

    // Parse the returned payload from lambda
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));
    console.log("Response:", payload);

    return payload;
  } catch (error) {
    console.error(`Error invoking Lambda ${functionName}:`, error);
    throw error;
  }
}
module.exports = { invokeLambdaFunctionParameters };
