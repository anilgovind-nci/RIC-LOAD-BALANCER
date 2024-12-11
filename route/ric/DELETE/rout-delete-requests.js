const { deleteRouterState } = require('../utils/stateManager.js');
const { router } = require('../utils/router.js');
const { lambdaNode } = require('./config.js');
async function deleteRouter(req, res) {
  // call router function with deleteRouterState
  await router(req, res, deleteRouterState, lambdaNode)
}
module.exports = deleteRouter;
