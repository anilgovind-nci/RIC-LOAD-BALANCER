const express = require("express");
const router = express.Router();

const getRouter = require("./GET/rout-get-requests");

router.get("/", (req, res) => {
    return (getRouter(req, res));
});

router.post("/", (req, res) => {
    res.send("Response from the test route folder file for post!");
});

module.exports = router;
