module.exports = async () => {
  // No cleanup needed for in-memory databases
  console.log('Jest global teardown: Complete (in-memory database requires no cleanup)');
};