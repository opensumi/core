
const sumi = require("sumi");
function activate(context) {
  console.log('Sumi worker extension is activated')
  return {
    name: 'worker',
  };
}
exports.activate = activate;
