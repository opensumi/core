const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const log = require('debug')('download-vscode-extension');
const { install } = require('@alipay/cloud-ide-ext-vscode-extension-builder');

// 放置 vscode extension 的目录
const targetDir = path.resolve(__dirname, '../extensions/');
// vscode extension 的 tar 包 oss 地址
const { extensions } = require(path.resolve(__dirname, '../config/vscode-extensions.json'));

// 限制并发数，运行promise
const parallelRunPromise = (lazyPromises, n) => {
  const results = [];
  let index = 0;
  let working = 0;
  let complete = 0;

  const addWorking = (res, rej) => {
    while (working < n && index < lazyPromises.length) {
      const current = lazyPromises[index++];
      working++;

      ((index) => {
        current().then(result => {
          working--;
          complete++;
          results[index] = result;

          if (complete === lazyPromises.length) {
            res(results);
            return;
          }

          // note: 虽然addWorking中有while，这里其实每次只会加一个promise
          addWorking(res, rej);
        }, rej);
      })(index - 1);
    }
  };

  return new Promise(addWorking);
};

const downloadVscodeExtensions = async () => {
  log('清空 vscode extension 目录：%s', targetDir);
  rimraf.sync(targetDir);
  mkdirp.sync(targetDir);

  const promises = [];
  const types = Object.keys(extensions);
  for (const type of types) {
    const items = extensions[type];

    for (const item of items) {
      const { name, id, version } = item;
      promises.push(async () => {
        log('开始安装：%s', name);
        await install(name, id, version, targetDir);
      });
    }
  }

  // 限制并发 promise 数
  await parallelRunPromise(promises, 3);
  log('安装完毕');
};

// 执行并捕捉异常
downloadVscodeExtensions().catch(e => {
  console.trace(e);
  process.exit(128);
});
