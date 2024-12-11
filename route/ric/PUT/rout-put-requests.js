const { putRouterState } = require('../utils/stateManager.js');
const { router } = require('../utils/router.js');
const { lambdaNode } = require('./config.js');

async function putRouter(req, res) {
  // call router function with putRouterState
  await router(req, res, putRouterState, lambdaNode)
}
module.exports = putRouter;
