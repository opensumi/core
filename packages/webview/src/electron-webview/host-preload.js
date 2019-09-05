const {basename, join} = require('path');
if (basename(join(__dirname, '..')) === 'src') {
  // 开发模式，直接使用tsnode
  require('ts-node/register');
}
require('./host-channel');