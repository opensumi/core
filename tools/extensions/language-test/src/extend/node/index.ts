export function activate(componentProxy) {
  console.log('activate ui simple node');
  let count = 0;

  return {
    async bizHello() {
      // await componentProxy.com1.changeTitle(`node ${count++}`);
      return 'biz node message ' + count;
    },
  };
}
