// The statemanger will work as a local registry and shared between every requests.
class StateManager {
    constructor(initialState) {
      this.state = { ...initialState };
    }
  
    get(key) {
      return this.state[key];
    }
  
    set(key, value) {
      this.state[key] = value;
    }
  
    update(key, callback) {
      if (typeof callback === 'function') {
        this.state[key] = callback(this.state[key]);
      }
    }
  }
  
  //post function record
  const postRouterState = new StateManager({
    firstRequest: true,
    lambdaAverageExecutionTime: 0,
    engagedLambdas: [],
    redisKey: '',
    secretManagerKey: 'postFunctionResourcesRediskey',
    lockRead:false,
  });

  //post function record
  const getRouterState = new StateManager({
    firstRequest: true,
    lambdaAverageExecutionTime: 0,
    engagedLambdas: [],
    redisKey: '',
    secretManagerKey: 'getFunctionResourcesRediskey',
    lockRead:false,
  });

  //post function record
  const putRouterState = new StateManager({
    firstRequest: true,
    lambdaAverageExecutionTime: 0,
    engagedLambdas: [],
    redisKey: '',
    secretManagerKey: 'putFunctionResourcesRediskey',
    lockRead:false,
  });

  //post function record
  const deleteRouterState = new StateManager({
    firstRequest: true,
    lambdaAverageExecutionTime: 0,
    engagedLambdas: [],
    redisKey: '',
    secretManagerKey: 'deleteFunctionResourcesRediskey',
    lockRead:false,
  });
  
  module.exports = { postRouterState, getRouterState, putRouterState, deleteRouterState };
  