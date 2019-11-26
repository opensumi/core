
const webpack = require('webpack');

const compiler = webpack(require('../entry/electron/browser/webpack.config'));

let started = false;

const { spawn } = require('child_process');

const { join } = require('path');

console.log('将以TS开发模式打开Electron，各进程(包括Webview)启动都会偏慢');

console.log('Compiling Browser Code...');

const watching = compiler.watch({
  // Example watchOptions
  aggregateTimeout: 300,
  poll: undefined
}, (err, stats) => {
  if (err) {
    console.error(err);
  } else  if (stats.hasErrors()) {
    console.error(stats.toString());
    process.exit(-128);
  }else {
    console.log('[' + new Date().toLocaleDateString() + '] browser compiled.')
    if(!started) {
      startElectron();
    }
  }
});

function startElectron() {
  started = true;
  console.log('Compile finished. Starting Electron...');
  const forked = spawn('npm',['run','start:electron-app'], {
    env: {...process.env},
    cwd: join(__dirname, '../'),
    stdio: ['inherit', 'inherit', 'inherit']
  })
  forked.on('exit', () => {
    process.exit();
  })
}
