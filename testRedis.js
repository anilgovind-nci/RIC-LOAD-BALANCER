const Redis = require("ioredis");

// Load environment variables
const redisHost = process.env.REDIS_HOST || "clustercfg.ric-rediscluster.69bhdo.euw1.cache.amazonaws.com";
const redisPort = process.env.REDIS_PORT || 6379;

// Initialize Redis Cluster client
const redisClient = new Redis.Cluster(
  [
    {
      port: redisPort,
      host: redisHost,
    },
  ],
  {
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      tls: {},
    },
  }
);

// Use a permanent Redis key
const redisKey = "ric-crud-get-lambdas";

const handler = async (event) => {
  try {
    console.log("Handler triggered with event:", event);

    const latencyCreate = await createData(); // Uncomment for testing
    const data = await getData(latencyCreate);

    const response = {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...data,
        redisHost,
      }),
    };

    console.log("Response generated:", response);
    return response;
  } catch (error) {
    console.error("Error in handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error", error: error.message }),
    };
  }
};

async function getData(latencyCreate) {
  try {
    console.log("Start getting data from Redis");

    const start = new Date();
    const data = JSON.parse(await redisClient.get(redisKey)); // Using the permanent key
    const end = new Date();

    console.log("Data retrieved successfully:", data);

    return {
      latencyRead: `${end - start}ms`,
      latencyCreate: `${latencyCreate}ms`,
      data,
    };
  } catch (error) {
    console.error("Error accessing data in Redis:", error);
    return {
      error: error.message,
      message: "Failed to retrieve data",
    };
  }
}

async function createData() {
  try {
    console.log("Start creating data in Redis");

    const start = new Date();

    const lambdaData = {
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

    // Save the structured data into Redis under the permanent key
    await redisClient.set(redisKey, JSON.stringify(lambdaData)); // Using the permanent key
    const end = new Date();

    console.log("Data created successfully in Redis");
    return end - start;
  } catch (error) {
    console.error("Error saving data in Redis:", error);
    throw error;
  }
}

// Auto-invocation of the handler function
(async () => {
  console.log("Starting execution...");
  const result = await handler({});
  console.log("Execution result:", result);
  process.exit(0); // Ensure the script exits after execution
})();

