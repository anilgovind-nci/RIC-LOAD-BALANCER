const express = require("express");
const app = express();
const port = 3000;

// Import routes 
const ricRoute = require("./route/ric/route-to-warm-lambda");
// Initialise redis handler function.
const { initializeRedisHandler } = require("./redis-handler/redisHandler"); // Import your redis handler

async function startApp() {
  try {
    // Initialize RedisHandler instance.
    // This handler will be used by every single request to do redis operations.
    const redisHandler = await initializeRedisHandler();

    // Middleware to pass redisHandler to all requests
    app.use((req, res, next) => {
      // Attach redisHandler to the request object
      req.redisHandler = redisHandler;  
      next();
    });
    app.use(express.json());

    // Define routes routes
    app.use("/ric", ricRoute);  // For /ric route

    // Start the server in configured port. For test purposes and all it set to 3000.
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Error initializing RedisHandler:", error);
  }
}

startApp();
