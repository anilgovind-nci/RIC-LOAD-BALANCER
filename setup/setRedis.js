
// Execute this code using before staring the server
// This will create records in redis.
const { initializeRedisHandler } = require("../redis-handler/redisHandler");

(async () => {
    console.log("Starting execution...");
    try {
        // inittialise redis handler
      const redisHandler = await initializeRedisHandler();
        
      // A dummy mode for initial setup of redis keys.
      // redis update function will update this once started executions.
      const storeData = {
        ActiveLambdas: {},
        lambdaAverageColdStartTime: 5000,
        lambdaAverageExecutionTime: 1000
      }

      await redisHandler.create("deleteLambdaDetailskey",storeData)
      await redisHandler.create("getLambdaDetailskey",storeData)
      await redisHandler.create("putLambdaDetailskey",storeData)
      await redisHandler.create("postLambdaDetailskey",storeData)
  
    //   console.log(await redisHandler.read("deleteLambdaDetailskey"))
    //   console.log(await redisHandler.read("postLambdaDetailskey"))
    //   console.log(await redisHandler.read("putLambdaDetailskey"))
    //   console.log(await redisHandler.read("getLambdaDetailskey"))
    } catch (error) {
      console.error("Error during execution:", error);
    }
    process.exit(0); // Ensure the script exits after execution
  })();