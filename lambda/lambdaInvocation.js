const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// Create a Lambda client
const lambdaClient = new LambdaClient({ region: "eu-west-1" }); // Replace with your AWS region

// Function to invoke the Lambda with query parameters
async function invokeLambdaFunctionWithQueryParams(functionName, queryParameters, requestBody) {
  const params = {
    FunctionName: functionName, // Replace with the actual Lambda function name
    InvocationType: "RequestResponse", // Synchronous invocation to get a response
    Payload: JSON.stringify({
      queryStringParameters: queryParameters,
      body: JSON.stringify(requestBody)
    }),
  };

  try {
    // Invoke the Lambda function
    const command = new InvokeCommand(params);
    const response = await lambdaClient.send(command);

    // Parse the returned payload
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));
    // console.log(`Lambda ${functionName} invoked with id: ${id}, pps: ${pps}`);
    console.log("Response:", payload);

    return payload; // Return the Lambda's response
  } catch (error) {
    console.error(`Error invoking Lambda ${functionName}:`, error);
    throw error; // Rethrow for error handling
  }
}
module.exports = { invokeLambdaFunctionWithQueryParams };
