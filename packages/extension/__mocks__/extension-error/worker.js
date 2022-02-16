const sumi = require('sumi');
function activate(context) {
  // eslint-disable-next-line no-console
  console.log('worker extension is activated2');
  return {};
}
exports.activate = activate;
