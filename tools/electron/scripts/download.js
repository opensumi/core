const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const log = require('debug')('download-vscode-extension');
const { ExtensionInstaller } = require('@ali/ide-extension-installer');
const extensionInstaller = new ExtensionInstaller({
  accountId: 'nGJBcqs1D-ma32P3mBftgsfq',
  masterKey: '-nzxLbuqvrKh8arE0grj2f1H',
  ignoreIncreaseCount: true,
  retry: 3,
});

// 放置 vscode extension 的目录
const targetDir = path.resolve(__dirname, '../extensions/');
// vscode extension 的 tar 包 oss 地址
const { extensions } = require(path.resolve(__dirname, '../../../configs/vscode-extensions.json'));

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
  const publishers = Object.keys(extensions);
  for (const publisher of publishers) {
    const items = extensions[publisher];

    for (const item of items) {
      const { name, version } = item;
      promises.push(async () => {
        console.log(`开始安装：${targetDir} ${publisher}.${name}@${version || 'latest'}`);
        await extensionInstaller.install({ publisher, dist: targetDir, ...item }).catch((e) => {
          console.log(`${name} 插件安装失败: ${e.message}`);
        });
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
