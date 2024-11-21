const Redis = require("ioredis");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Function to fetch the Redis hostname and port from Secrets Manager
async function fetchRedisSecrets(secretName, region) {
  try {
    const client = new SecretsManagerClient({ region });
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT", // Defaults to AWSCURRENT if unspecified
      })
    );
    const secret = JSON.parse(response.SecretString); // Assuming secret is stored as JSON
    return {
      redisHost: secret.RedisHost,
      redisPort: secret.redisPort || 6379, // Default to 6379 if not specified
    };
  } catch (error) {
    console.error("Error fetching secrets:", error);
    throw error;
  }
}

// RedisHandler class with connection established in the constructor
class RedisHandler {
  constructor(redisHost, redisPort) {
    if (!redisHost || !redisPort) {
      throw new Error("Redis host and port are required to initialize RedisHandler.");
    }

    // Initialize Redis client
    this.redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      tls: {}, // Uncomment if SSL is required
    });

    this.redisClient.on("connect", () => {
      console.log("Connected to Redis successfully.");
    });

    this.redisClient.on("error", (err) => {
      console.error("Redis connection error:", err);
    });
  }

  async create(key, data) {
    try {
      const jsonData = JSON.stringify(data);
      await this.redisClient.set(key, jsonData);
      // console.log(`Data created under key "${key}":`, data);
    } catch (err) {
      console.error("Error during create:", err);
    }
  }

  async read(key) {
    try {
      const data = await this.redisClient.get(key);
      if (data) {
        // Try to parse as JSON, if it fails, return the data as is
        let parsedData;
        try {
          parsedData = JSON.parse(data);
          // console.log(`Data for key "${key}" (JSON):`, parsedData);
        } catch (e) {
          // If it's not JSON, return the raw string data
          parsedData = data;
          console.log(`Data for key "${key}" (Plain text):`, parsedData);
        }
        return parsedData;
      } else {
        console.log(`No data found for key "${key}".`);
        return null;
      }
    } catch (err) {
      console.error("Error during read:", err);
    }
  }

  async update(key, lambdaKey, changeValue) {
    try {
      const existingData = await this.read(key);
      if (existingData && existingData.ActiveLambdas[lambdaKey]) {
        // Modify the AverageTimeToCompleteExecution directly with the changeValue
        existingData.ActiveLambdas[lambdaKey].AverageTimeToCompleteExecution += changeValue;
  
        // Save the updated data back to Redis
        await this.create(key, existingData);
  
        return existingData;
      } else {
        console.error("Lambda not found:", lambdaKey);
      }
    } catch (err) {
      console.error("Error during update:", err);
    }
  }
  

  async delete(key) {
    try {
      await this.redisClient.del(key);
      // console.log(`Key "${key}" deleted.`);
    } catch (err) {
      console.error("Error during delete:", err);
    }
  }

  disconnect() {
    this.redisClient.disconnect();
    console.log("Redis connection closed.");
  }
}


// Function to initialize RedisHandler
async function initializeRedisHandler() {
  const secretName = "ric-credentials"; // Replace with your secret name
  const region = "us-east-1"; // Replace with your region
  // Fetch Redis host and port from Secrets Manager
  const { redisHost, redisPort } = await fetchRedisSecrets(secretName, region);
  console.log("redisHost", redisHost);
  // Create and return the RedisHandler instance
  return new RedisHandler(redisHost, redisPort);
}

// (async () => {
//   console.log("Starting execution...");
//   try {
//     const storeData = {
//       ActiveLambdas: {
//           LambdaOne: {
//               targetLambda: "ric-crud-application-dev-ricGet",
//               AverageTimeToCompleteExecution: 0,
//               isActive: true, 
//           },
//           LambdaTwo: {
//               targetLambda: "ric-crud-application-dev-ricGet-6d888bfd-5f2f-4cb2-9fcb-6acbb842",
//               AverageTimeToCompleteExecution: 0,
//               isActive: false, 
//           },
//       },
//       lambdaAverageColdStartTime: 20,
//       lambdaAverageExecutionTime: 1
//   }
//   const storeUpdatedData = {
//     ActiveLambdas: {
//         LambdaOne: {
//             targetLambda: "lambdanew",
//             AverageTimeToCompleteExecution: 0,
//             isActive: false, 
//         },
//         LambdaTwo: {
//             targetLambda: "lambda2",
//             AverageTimeToCompleteExecution: 0,
//             isActive: false, 
//         },
//     },
//     lambdaAverageColdStartTime: 50,
//     lambdaAverageExecutionTime: 10
// }
//   const getLambdaDetailskey = "getLambdaDetailskey"
//     const redisHandler = await initializeRedisHandler();
// //     await redisHandler.create(getLambdaDetailskey,storeData)
    
//     await redisHandler.create(getLambdaDetailskey,storeData);
//     let data = await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
//     console.log(data)
// //     // await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
// //     // await redisHandler.delete(getLambdaDetailskey); 
// //     // await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
//     redisHandler.disconnect(); // Disconnect after operation is complete
//   } catch (error) {
//     console.error("Error during execution:", error);
//   }
//   process.exit(0); // Ensure the script exits after execution
// })();
module.exports = { initializeRedisHandler }; // Ensure correct export
