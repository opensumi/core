exports.activate = async function (context) {
  context.registerExtendModuleService({
    hello: () => {
      console.log('hello');
    },
  });
  console.log('extend node extension activated');
  return {};
}
