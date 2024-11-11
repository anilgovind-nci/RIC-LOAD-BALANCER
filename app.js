const express = require("express");
const app = express();
const port = 3000;

// Import routes
const homeRoute = require("./route/route-root");
const testRoute = require("./route/test/route-to-warm-lambda");

// Use the imported routes
app.use("/", homeRoute);      // for root route
app.use("/test", testRoute);   // for /test route

app.listen(port, () => {
    console.log(`Server listening at port: ${port}`);
});
