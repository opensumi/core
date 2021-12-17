exports.activate = async function (context) {
  console.log('activated2');
  if (context) {
    throw new Error('Test caught exception');
  }
  return {};
};
