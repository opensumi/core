
const kaitian = require("kaitian");
function activate(context) {
  console.log('KAITIAN worker extension is activated')
  return {
    name: 'worker',
  };
}
exports.activate = activate;
