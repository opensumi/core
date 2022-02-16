exports.activate = async function (context) {
  // eslint-disable-next-line no-console
  console.log('activated2');
  if (context) {
    throw new Error('Test caught exception');
  }
  return {};
};
