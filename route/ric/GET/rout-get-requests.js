const { getRouterState } = require('../utils/stateManager.js');
const { router } = require('../utils/router.js');
const { lambdaNode } = require('./config.js');

async function getRouter(req, res) {
  await router(req, res, getRouterState, lambdaNode)
}
module.exports = getRouter;
