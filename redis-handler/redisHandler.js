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
    const secretDetails = JSON.parse(response.SecretString); // Assuming secret is stored as JSON
    // return {
    //   redisHost: secret.RedisHost,
    //   redisPort: secret.redisPort || 6379, // Default to 6379 if not specified
    // };
    return secretDetails
  } catch (error) {
    console.error("Error fetching secrets:", error);
    throw error;
  }
}

// RedisHandler class with connection established in the constructor
class RedisHandler {
  static RedisSecretDetails
  constructor(secretDetails) {
    this.RedisSecretDetails = secretDetails;
    const redisHost = secretDetails.RedisHost;
    const redisPort = secretDetails.redisPort || 6379; // Default to 6379 if not specified
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

  async addLambdaNode(key, lambdaValue) {
    const existingData = await this.read(key);
    if (existingData) {
      const existingKeys = Object.keys(existingData.ActiveLambdas).map(Number);
      let lambdaKey = 1; // Start from 1
      while (existingKeys.includes(lambdaKey)) {
        lambdaKey++;
      }
      existingData.ActiveLambdas[lambdaKey] = lambdaValue;
      // console.log("from addLambdaNode", existingData)
      await this.create(key, existingData);
      return lambdaKey
    }
    else {
      console.log("error occured in adding new lambda node to redis")
      return null
    }
  }

  async removeLambdaNode(key, lambdaKey, lambdaValue) {
    try {
      // const addLambdaNodeResponse = await this.addLambdaNode(key,lambdaValue)
      // const existingData = await this.read(key);
      setTimeout(async () => {
        const existingData = await this.read(key);
        // console.log("the log for active length", Object.keys(existingData.ActiveLambdas).length)
        const activeLambdas = Object.entries(existingData.ActiveLambdas).filter(
          ([key, value]) => value.isActive
        );
        if (activeLambdas.length<=1) {
          console.log('inside the if block')
          const newLambdaNodeKey = await this.addLambdaNode(key, lambdaValue)
          await this.removeLambdaNode(key, newLambdaNodeKey, lambdaValue)
        }
        setTimeout(async () => {
          const currentData = await this.read(key);
          currentData.ActiveLambdas[lambdaKey].isActive = false
          await this.create(key, currentData);
          console.log("from inside of making the lambda to false", await this.read(key))
        }, 100) // Give time for if block to update the redis before making every 
        //active lambdas to false
        // And will help to stop 2 recursion functions in the server.
        setTimeout(async () => {
            const currentData = await this.read(key);
            delete currentData.ActiveLambdas[lambdaKey]
            await this.create(key, currentData);
            console.log("from inside of deleting the lambda", await this.read(key))
        }, 900000);//15 minute sleep
      }, 600000); //10 minute sleep
    } catch (err) {
      console.error("Error during update:", err);
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
  const secretDetails = await fetchRedisSecrets(secretName, region);
  // console.log("redisHost", redisHost);
  // Create and return the RedisHandler instance
  return new RedisHandler(secretDetails);
}

(async () => {
  console.log("Starting execution...");
  try {
    const storeData = {
      ActiveLambdas: {
        1: {
          targetLambda: "ric-crud-application-dev-ricGet",
          AverageTimeToCompleteExecution: 0,
          isActive: true,
        },
        2: {
          targetLambda: "ric-crud-application-dev-ricGet-6d888bfd-5f2f-4cb2-9fcb-6acbb842",
          AverageTimeToCompleteExecution: 0,
          isActive: true,
        },
      },
      lambdaAverageColdStartTime: 20,
      lambdaAverageExecutionTime: 150
    }
    const storeUpdatedData = {
      ActiveLambdas: {},
      lambdaAverageColdStartTime: 5000,
      lambdaAverageExecutionTime: 1000
    }
    const getLambdaDetailskey = "deleteLambdaDetailskey"
    const redisHandler = await initializeRedisHandler();

    // await redisHandler.create("getLambdaDetailskey",storeUpdatedData)
    console.log(await redisHandler.read("postLambdaDetailskey"))
    
    let data
    // await redisHandler.read("deleteLambdaDetailskey")
    // data = await redisHandler.read("deleteLambdaDetailskey")
    // data.ActiveLambdas = {}
    // console.log(data)
    // await redisHandler.create("deleteLambdaDetailskey",data)
    // console.log(await redisHandler.read("deleteLambdaDetailskey"))


    // data = await redisHandler.read("getLambdaDetailskey")
    // data.ActiveLambdas = {}
    // console.log(data)
    // await redisHandler.create("getLambdaDetailskey",data)
    // console.log(await redisHandler.read("getLambdaDetailskey"))

    // data = await redisHandler.read("putLambdaDetailskey")
    // data.ActiveLambdas = {}
    // console.log(data)
    // await redisHandler.create("putLambdaDetailskey",data)
    // console.log(await redisHandler.read("putLambdaDetailskey"))

    // data = await redisHandler.read("postLambdaDetailskey")
    // data.ActiveLambdas = {}
    // console.log(data)
    // await redisHandler.create("postLambdaDetailskey",data)
    // console.log(await redisHandler.read("postLambdaDetailskey"))

    // console.log(await redisHandler.read("deleteLambdaDetailskey"))
    // console.log(await redisHandler.read("postLambdaDetailskey"))
    // console.log(await redisHandler.read("putLambdaDetailskey"))
    // console.log(await redisHandler.read("getLambdaDetailskey"))




    // data.ActiveLambdas = {}
    // console.log(data)
    // await redisHandler.create(getLambdaDetailskey,data)
    // console.log(await redisHandler.read(getLambdaDetailskey))


    // console.log(await redisHandler.create(getLambdaDetailskey,data))
    // await redisHandler.create(getLambdaDetailskey,storeData)
    // await redisHandler.create(getLambdaDetailskey,storeUpdatedData);
    // await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
    // console.log(await redisHandler.read(getLambdaDetailskey))



    // await redisHandler.create(getLambdaDetailskey, storeUpdatedData);
    // let data = await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
    // console.log(data)
    // const newNode = {
    //   targetLambda: "ric-crud-application-dev-ricGet",
    //   AverageTimeToCompleteExecution: 0,
    //   isActive: true,
    // }
    // const newKey = await redisHandler.addLambdaNode(getLambdaDetailskey, newNode)
    // await redisHandler.removeLambdaNode(getLambdaDetailskey, newKey, newNode)



    // setTimeout(async () => {
    //   console.log("adding new node 1")
    //   const newKey = await redisHandler.addLambdaNode(getLambdaDetailskey, newNode)
    // await redisHandler.removeLambdaNode(getLambdaDetailskey, newKey, newNode)
    // }, 10000)
    // setTimeout(async () => {
    //   console.log("adding new node 2")
    //   const newKey = await redisHandler.addLambdaNode(getLambdaDetailskey, newNode)
    //   await redisHandler.removeLambdaNode(getLambdaDetailskey, newKey, newNode)
    // }, 20000)
    //     // await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
    //     // await redisHandler.delete(getLambdaDetailskey); 
    //     // await redisHandler.read(getLambdaDetailskey); // Wait for the read to complete
    // redisHandler.disconnect(); // Disconnect after operation is complete
  } catch (error) {
    console.error("Error during execution:", error);
  }
  // process.exit(0); // Ensure the script exits after execution
})();
module.exports = { initializeRedisHandler }; // Ensure correct export
