function validateRedisResponseAndReturnActiveLambdas(redisResponse) {
    if (!redisResponse || !redisResponse.ActiveLambdas) {
      return { error: { status: 404, message: "Lambda details not found." } };
    }
  
    const activeLambdas = Object.entries(redisResponse.ActiveLambdas).filter(
      ([key, value]) => value.isActive
    );
  
    if (activeLambdas.length === 0) {
      return { error: { status: 404, message: "No active Lambdas found." } };
    }
  
    return activeLambdas;
  }

  module.exports = { validateRedisResponseAndReturnActiveLambdas };