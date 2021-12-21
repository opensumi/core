// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sumi = require('sumi');

function activate() {
  console.log('Sumi worker extension is activated');
  return {
    name: 'worker',
  };
}
exports.activate = activate;
