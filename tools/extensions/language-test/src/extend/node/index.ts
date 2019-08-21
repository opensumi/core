import * as kaitian from 'kaitian'

export function activate(componentProxy) {
  console.log('activate ui simple node', 'kaitian');
  console.log(kaitian)
  let count = 0;

  return {
    async bizHello() {
      //TODO: 给出错误提示
      await componentProxy.comA.changeTitle(`node ${count++}`);
      await kaitian.layout.toggleBottomPanel();
      return 'biz node message ' + count;
    },
  };
}
