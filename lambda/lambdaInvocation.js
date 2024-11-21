const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");

// Create a Lambda client
const lambdaClient = new LambdaClient({ region: "eu-west-1" }); // Replace with your AWS region

// Function to invoke the Lambda with query parameters
async function invokeLambdaFunctionWithQueryParams(functionName, id, pps) {
  const params = {
    FunctionName: functionName, // Replace with the actual Lambda function name
    InvocationType: "RequestResponse", // Synchronous invocation to get a response
    Payload: JSON.stringify({
      queryStringParameters: {
        id: id,
        pps: pps,
      },
    }),
  };

  try {
    // Invoke the Lambda function
    const command = new InvokeCommand(params);
    const response = await lambdaClient.send(command);

    // Parse the returned payload
    const payload = JSON.parse(new TextDecoder().decode(response.Payload));
    console.log(`Lambda ${functionName} invoked with id: ${id}, pps: ${pps}`);
    console.log("Response:", payload);

    return payload; // Return the Lambda's response
  } catch (error) {
    console.error(`Error invoking Lambda ${functionName}:`, error);
    throw error; // Rethrow for error handling
  }
}
module.exports = { invokeLambdaFunctionWithQueryParams };
// (async () => {
//   console.log("Starting execution...");
//   try {
//     const functionName = "ric-crud-application-dev-ricGet"; // Replace with your Lambda function name
//     const id = "75";
//     const pps = "999";

//     const lambdaResponse = await invokeLambdaFunctionWithQueryParams(functionName, id, pps);
//     // console.log("Lambda Response:", lambdaResponse);
//   } catch (error) {
//     console.error("Error during execution:", error);
//   }
//   process.exit(0); // Ensure the script exits after execution
// })();
