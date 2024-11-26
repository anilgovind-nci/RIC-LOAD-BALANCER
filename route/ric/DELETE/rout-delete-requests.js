const { deleteRouterState } = require('../utils/stateManager.js');
const { router } = require('../utils/router.js');
const { lambdaNode } = require('./config.js');

async function deleteRouter(req, res) {
  await router(req, res, deleteRouterState, lambdaNode)
}
module.exports = deleteRouter;
