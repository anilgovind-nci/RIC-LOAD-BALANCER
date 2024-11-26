const { postRouterState } = require('../utils/stateManager.js');
const { router } = require('../utils/router.js');
const { lambdaNode } = require('./config.js');

async function postRouter(req, res) {
  await router(req, res, postRouterState, lambdaNode)
}
module.exports = postRouter;
