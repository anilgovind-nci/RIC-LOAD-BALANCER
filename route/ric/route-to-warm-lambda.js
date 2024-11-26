const express = require("express");
const router = express.Router();

const getRouter = require("./GET/rout-get-requests");
const postRouter = require("./POST/rout-post-requests");
const putRouter = require("./PUT/rout-put-requests");
const deleteRouter = require("./DELETE/rout-delete-requests");




router.get("/", (req, res) => {
    return (getRouter(req, res));
});

router.post("/", (req, res) => {
    return (postRouter(req, res))
});

router.put("/", (req, res) => {
    return (putRouter(req, res))
});

router.delete("/", (req, res) => {
    return (deleteRouter(req, res))
});

module.exports = router;
