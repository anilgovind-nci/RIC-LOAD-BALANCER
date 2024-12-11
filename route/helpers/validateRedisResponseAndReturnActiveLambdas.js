//validate the response from redis and return active nodes.
function validateRedisResponseAndReturnActiveLambdas(redisResponse) {
    if (!redisResponse || !redisResponse.ActiveLambdas) {
      return { error: { status: 404, message: "Lambda details not found." } };
    }
    //iterate through redis response and set activeLambdas
    const activeLambdas = Object.entries(redisResponse.ActiveLambdas).filter(
      ([key, value]) => value.isActive
    );
  
    if (activeLambdas.length === 0) {
      return { error: { status: 404, message: "No active Lambdas found." } };
    }
  
    return activeLambdas;
  }

  module.exports = { validateRedisResponseAndReturnActiveLambdas };