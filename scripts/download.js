const path = require('path');
const querystring = require('querystring');
const rimraf = require('rimraf');
const fs = require('fs-extra');
const compressing = require('compressing');
const log = require('debug')('InstallExtension');
const os = require('os');
const nodeFetch = require('node-fetch');
const awaitEvent = require('await-event');
const pipeline = require('stream').pipeline;
const retry = require('async-retry');
const marketplaceType = process.env.MARKETPLACE ?? 'opentrs';

// 放置 extension 的目录
const targetDir = path.resolve(__dirname, '../tools/extensions/');

const extensionFileName = marketplaceType === 'opentrs' ? 'opentrs-extensions.json' : 'vscode-extensions.json';
const { extensions } = require(path.resolve(__dirname, `../configs/${extensionFileName}`));
const headers = {};

if (marketplaceType === 'opentrs') {
  headers['x-master-key'] = '_V_LPJ6Ar-1nrSVa05xDGBYp';
  headers['x-account-id'] = 'clcJKq_Gea47whxAJGrgoYqf';
  headers['x-download-mode'] = 'redirect';
}

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

async function downloadExtension(url, namespace, extensionName) {
  const tmpPath = path.join(os.tmpdir(), 'extension');
  const [tempFileName, queryStr] = path.basename(url).split('?');
  const { version = '' } = querystring.parse(queryStr);
  const tmpZipFile = path.join(tmpPath, `${tempFileName}-${version}`);
  await fs.mkdirp(tmpPath);

  const tmpStream = fs.createWriteStream(tmpZipFile);
  const res = await nodeFetch(url, { timeout: 100000, headers });

  if (res.status !== 200) {
    throw {
      message: `${res.status} ${res.statusText}`,
    };
  }

  res.body.pipe(tmpStream);
  await Promise.race([awaitEvent(res.body, 'end'), awaitEvent(res.body, 'error')]);
  tmpStream.close();

  const targetDirName = path.basename(`${namespace}.${extensionName}-${version}`);

  return { tmpZipFile, targetDirName };
}

function unzipFile(dist, targetDirName, tmpZipFile) {
  const sourcePathRegex = new RegExp('^extension');
  return new Promise((resolve, reject) => {
    try {
      const extensionDir = path.join(dist, targetDirName);
      const stream = new compressing.zip.UncompressStream({ source: tmpZipFile });
      stream
        .on('error', (err) => {
          reject(err);
        })
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
  let downloadUrl = '';

  if (marketplaceType === 'opentrs') {
    downloadUrl = `https://marketplace.opentrs.cn/openapi/ide/download/${namespace}.${name}?version=${version}`;
  } else {
    const path = version ? `${namespace}/${name}/${version}` : `${namespace}/${name}`;
    const getDetailApi = `https://open-vsx.org/api/${path}`;
    const res = await nodeFetch(getDetailApi, { timeout: 100000, headers });
    const data = await res.json();

    downloadUrl = data.files?.download;
  }

  if (downloadUrl) {
    // 下载解压插件容易出错，因此这里加一个重试逻辑
    await retry(
      async () => {
        const { targetDirName, tmpZipFile } = await downloadExtension(downloadUrl, namespace, name);
        await unzipFile(targetDir, targetDirName, tmpZipFile);
        rimraf.sync(tmpZipFile);
      },
      { retries: 5 },
    );
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
