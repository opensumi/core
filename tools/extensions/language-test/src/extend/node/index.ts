export function activate(componentProxy) {
  console.log('activate ui simple node');
  let count = 0;

  return {
    async bizHello() {
      //TODO: 给出错误提示
      await componentProxy.comA.changeTitle(`node ${count++}`);
      return 'biz node message ' + count;
    },
  };
}
