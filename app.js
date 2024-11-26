const express = require("express");
const app = express();
const port = 3000;

// Import routes
const homeRoute = require("./route/route-root");
const testRoute = require("./route/test/route-to-warm-lambda");
const { initializeRedisHandler } = require("./redis-handler/redisHandler"); // Import your redis handler

async function startApp() {
  try {
    // Initialize RedisHandler instance
    const redisHandler = await initializeRedisHandler();

    // Middleware to pass redisHandler to all routes
    app.use((req, res, next) => {
      req.redisHandler = redisHandler;  // Attach redisHandler to the request object
      next();  // Move on to the next middleware or route handler
    });
    app.use(express.json());

    // Use routes
    app.use("/", homeRoute);  // For root route
    app.use("/test", testRoute);  // For /test route

    // Start the server
    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Error initializing RedisHandler:", error);
  }
}

startApp();
