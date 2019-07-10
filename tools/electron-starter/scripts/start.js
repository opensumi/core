
const webpack = require('webpack');

const compiler = webpack(require('../webpack.config'));
 
let started = false;

const { spawn } = require('child_process');

const { join } = require('path');

console.log('Compiling Browser Code...');

const watching = compiler.watch({
  // Example watchOptions
  aggregateTimeout: 300,
  poll: undefined
}, (err, stats) => { 
  if (err) {
    console.error(err);
  } else {
    console.log('browser compiled.')
    if(!started) {
      startElectron();
    }
  }
});

function startElectron() {
  started = true;
  console.log('Compile finished. Starting Electron...');
  const forked = spawn('npm',['run','start:electron'], {
    env: {...process.env},
    cwd: join(__dirname, '../'),
    stdio: ['inherit', 'inherit', 'inherit']
  })
  forked.on('exit', () => {
    process.exit();
  })
}