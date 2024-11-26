const express = require("express");
const router = express.Router();

const getRouter = require("./GET/rout-get-requests");
const postRouter = require("./POST/rout-post-requests");


router.get("/", (req, res) => {
    return (getRouter(req, res));
});

router.post("/", (req, res) => {
    return (postRouter(req, res))
});

module.exports = router;
