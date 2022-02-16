exports.activate = async function (context) {
  context.registerExtendModuleService({
    hello: () => {
      // eslint-disable-next-line no-console
      console.log('hello');
    },
  });
  // eslint-disable-next-line no-console
  console.log('extend node extension activated');
  return {};
};
