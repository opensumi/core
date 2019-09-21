import * as kaitian from 'kaitian'

export function activate(context) {
  const {componentProxy, registerExtendModuleService} = context
  console.log('activate ui simple node', 'kaitian');
  console.log(kaitian)
  let count = 0;

  registerExtendModuleService({
    async bizWorkerHello() {
      //TODO: 给出错误提示
      await componentProxy.comA.changeTitle(`worker ${count++}`);
      await kaitian.layout.toggleBottomPanel();
      return 'biz node message ' + count;
    },
  });
}
