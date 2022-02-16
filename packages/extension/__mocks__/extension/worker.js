const sumi = require('sumi');
function activate(context) {
  // eslint-disable-next-line no-console
  console.log('Sumi worker extension is activated');
  return {
    name: 'worker',
  };
}
exports.activate = activate;
