const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.send("Response from the route folder file!");
});

module.exports = router;
