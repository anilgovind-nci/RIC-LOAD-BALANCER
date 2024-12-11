const Redis = require("ioredis");
const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

// Function to fetch the redis hostname and port from AWS recrets manager
async function fetchRedisSecrets(secretName, region) {
  try {
    // initialise client for secret manager
    const client = new SecretsManagerClient({ region });
    //collecting secrets
    const response = await client.send(
      new GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: "AWSCURRENT",
      })
    );
    const secretDetails = JSON.parse(response.SecretString);
    return secretDetails
  } catch (error) {
    console.error("Error fetching secrets from SM:", error);
    throw error;
  }
}

// RedisHandler class with connection established code in the constructor
class RedisHandler {
  static RedisSecretDetails
  constructor(secretDetails) {
    //retriving redis secret values from class invocation parameter.
    this.RedisSecretDetails = secretDetails;
    const redisHost = secretDetails.RedisHost;
    const redisPort = secretDetails.redisPort || 6379;
    if (!redisHost || !redisPort) {
      throw new Error("redis host and port are required for RedisHandler.");
    }

    // initialize Redis client with received secrets
    this.redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      tls: {},
    });

    this.redisClient.on("connect", () => {
      console.log("connected to redis successfully.");
    });

    this.redisClient.on("error", (err) => {
      console.error("redis connection error:", err);
    });
  }
  //create function for having new record in redis
  async create(key, data) {
    try {
      const jsonData = JSON.stringify(data);
      await this.redisClient.set(key, jsonData);
    } catch (err) {
      console.error("Error during create:", err);
    }
  }
  //read function for reading the data from redis
  async read(key) {
    try {
      const data = await this.redisClient.get(key);
      if (data) {
        let parsedData;
        try {
          // parse received data from redis
          parsedData = JSON.parse(data);
        } catch (e) {
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
  // addLambdaNode function is for adding a new node to redis.
  // function will make sure to select a least possible number as node key.
  // this will reduce the size of data in transit so better speed in redis operations
  async addLambdaNode(key, lambdaValue) {
    const existingData = await this.read(key);
    if (existingData) {
      const existingKeys = Object.keys(existingData.ActiveLambdas).map(Number);
      let lambdaKey = 1;
      while (existingKeys.includes(lambdaKey)) {
        lambdaKey++;
      }
      existingData.ActiveLambdas[lambdaKey] = lambdaValue;
      // call create function to add the new node.
      await this.create(key, existingData);
      return lambdaKey
    }
    else {
      console.log("error occured in adding new lambda node to redis")
      return null
    }
  }
  // This function is for managing the lambda nodes in redis.
  // It will deactivate a node every 3 minutes of its creation.
  // The node will have lifetime of five more minutes to perform its pending tasks
  // After 5 minutes the node will be delete
  //Function will ensure atleast one node is active all the time.
  async removeLambdaNode(key, lambdaKey, lambdaValue) {
    try {
      setTimeout(async () => {
        const existingData = await this.read(key);
        const activeLambdas = Object.entries(existingData.ActiveLambdas).filter(
          ([key, value]) => value.isActive
        );
        if (activeLambdas.length<=1) {
          // create the node
          const newLambdaNodeKey = await this.addLambdaNode(key, lambdaValue)
          // call removeLambdaNode recursively to control the life cycle of created node
          await this.removeLambdaNode(key, newLambdaNodeKey, lambdaValue)
        }
        // wait for the above if loop to complete.
        // give time for if block to update the redis before making every active lambdas to false
        setTimeout(async () => {
          const currentData = await this.read(key);
          // deactivate the node
          currentData.ActiveLambdas[lambdaKey].isActive = false
          await this.create(key, currentData);
          console.log("from inside of making the lambda to false", await this.read(key))
        }, 100) 
        setTimeout(async () => {
            const currentData = await this.read(key);
            // delete the node
            delete currentData.ActiveLambdas[lambdaKey]
            await this.create(key, currentData);
            console.log("from inside of deleting the lambda", await this.read(key))
        }, 300000);//5 minute sleep
      }, 180000); //3 minute sleep
    } catch (err) {
      console.error("Error during update:", err);
    }
  }
  // update function to update the record in redis
  async update(key, lambdaKey, changeValue) {
    try {
      const existingData = await this.read(key);
      if (existingData && existingData.ActiveLambdas[lambdaKey]) {
        // modify the AverageTimeToCompleteExecution directly with the changeValue
        let newAverageTimeToCompleteExecution = existingData.ActiveLambdas[lambdaKey].AverageTimeToCompleteExecution + changeValue
        if (newAverageTimeToCompleteExecution < 0){
          newAverageTimeToCompleteExecution = 0
        }
        existingData.ActiveLambdas[lambdaKey].AverageTimeToCompleteExecution = newAverageTimeToCompleteExecution;
        // save the updated data back to Redis
        await this.create(key, existingData);
        return existingData;
      } else {
        console.error("Lambda not found:", lambdaKey);
      }
    } catch (err) {
      console.error("Error during update:", err);
    }
  }

  // function to delete the key from redis.
  async delete(key) {
    try {
      await this.redisClient.del(key);
    } catch (err) {
      console.error("Error during delete:", err);
    }
  }
  // function to disconnect from redis
  disconnect() {
    this.redisClient.disconnect();
    console.log("Redis connection closed.");
  }
}
// Function to initialize RedisHandler
async function initializeRedisHandler() {
  // secret key of our secret manager. 
  const secretName = "ric-credentials";
  const region = "us-east-1"; 
  // Fetch Redis host and port from Secrets Manager
  const secretDetails = await fetchRedisSecrets(secretName, region);
  //initialise redis handler class
  return new RedisHandler(secretDetails);
}
module.exports = { initializeRedisHandler }; // Ensure correct export
