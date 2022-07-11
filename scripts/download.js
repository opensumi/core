const path = require('path');
const rimraf = require('rimraf');
const fs = require('fs-extra');
const compressing = require('compressing');
const log = require('debug')('InstallExtension');
const os = require('os');
const nodeFetch = require('node-fetch');
const awaitEvent = require('await-event');
const pipeline = require('stream').pipeline;
const { v4 } = require('uuid');

// 放置 extension 的目录
const targetDir = path.resolve(__dirname, '../tools/extensions/');

const { extensions } = require(path.resolve(__dirname, '../configs/vscode-extensions.json'));

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
        current().then((result) => {
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

// const api = 'https://open-vsx.org/api/';
const api = 'https://marketplace.smartide.cn/api/'; // China Mirror

async function downloadExtension(url, namespace, extensionName) {
  const tmpPath = path.join(os.tmpdir(), 'extension', v4());
  const tmpZipFile = path.join(tmpPath, path.basename(url));
  await fs.mkdirp(tmpPath);

  const tmpStream = fs.createWriteStream(tmpZipFile);
  const res = await nodeFetch(url, { timeout: 100000 });

  res.body.pipe(tmpStream);
  await Promise.race([awaitEvent(res.body, 'end'), awaitEvent(res.body, 'error')]);
  tmpStream.close();

  const targetDirName = path.basename(`${namespace}.${extensionName}`);

  return { tmpZipFile, targetDirName };
}

function unzipFile(dist, targetDirName, tmpZipFile) {
  const sourcePathRegex = new RegExp('^extension');
  return new Promise((resolve, reject) => {
    try {
      const extensionDir = path.join(dist, targetDirName);
      const stream = new compressing.zip.UncompressStream({ source: tmpZipFile });
      stream
        .on('error', reject)
        .on('finish', () => {
          if (!fs.pathExistsSync(path.join(extensionDir, 'package.json'))) {
            reject(`Download Error: ${extensionDir}/package.json`);
            return;
          }
          fs.remove(tmpZipFile).then(() => resolve(extensionDir));
        })
        .on('entry', (header, stream, next) => {
          stream.on('end', next);
          if (!sourcePathRegex.test(header.name)) {
            stream.resume();
            return;
          }
          let fileName = header.name.replace(sourcePathRegex, '');
          if (/\/$/.test(fileName)) {
            const targetFileName = path.join(extensionDir, fileName);
            fs.mkdirp(targetFileName, (err) => {
              if (err) {
                return reject(err);
              }
              stream.resume();
            });
            return;
          }
          const targetFileName = path.join(extensionDir, fileName);
          fs.mkdirp(path.dirname(targetFileName), (err) => {
            if (err) {
              return reject(err);
            }
            const writerStream = fs.createWriteStream(targetFileName, { mode: header.mode });
            pipeline(stream, writerStream, (err) => {
              if (err) {
                return reject(err);
              }
            });
          });
        });
    } catch (err) {
      reject(err);
    }
  });
}

const installExtension = async (namespace, name, version) => {
  const path = version ? `${namespace}/${name}/${version}` : `${namespace}/${name}`;
  const res = await nodeFetch(`${api}${path}`, {
    timeout: 100000,
  });
  const data = await res.json();
  if (data.files && data.files.download) {
    const { targetDirName, tmpZipFile } = await downloadExtension(data.files.download, namespace, name);
    // 解压插件
    await unzipFile(targetDir, targetDirName, tmpZipFile);
    rimraf.sync(tmpZipFile);
  }
};

const downloadVscodeExtensions = async () => {
  log('清空 extension 目录：%s', targetDir);
  rimraf.sync(targetDir);
  fs.mkdirpSync(targetDir);

  const promises = [];
  const publishers = Object.keys(extensions);
  for (const publisher of publishers) {
    const items = extensions[publisher];

    for (const item of items) {
      const { name, version } = item;
      promises.push(async () => {
        log('开始安装：%s', name, version);
        try {
          await installExtension(publisher, name, version);
        } catch (e) {
          console.log(`${name} 插件安装失败: ${e.message}`);
        }
      });
    }
  }

  // 限制并发 promise 数
  await parallelRunPromise(promises, 3);
  log('安装完毕');
};

// 执行并捕捉异常
downloadVscodeExtensions().catch((e) => {
  console.trace(e);
  rimraf();
  process.exit(128);
});
