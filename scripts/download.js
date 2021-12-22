const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const fs = require('fs-extra');
const yauzl = require('yauzl');
const log = require('debug')('InstallExtension');
const os = require('os');
const got = require('got');
const urllib = require('urllib');
const awaitEvent = require('await-event');
const { v4 } = require('uuid');

// 放置 vscode extension 的目录
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

const api = 'https://open-vsx.org/api/';

async function downloadExtension (url, namespace, extensionName) {
  const tmpPath = path.join(os.tmpdir(), 'extension', v4());
  const tmpZipFile = path.join(tmpPath, path.basename(url));
  await fs.mkdirp(tmpPath);

  const tmpStream = fs.createWriteStream(tmpZipFile);
  const data = await got.default.stream(url, { timeout: 100000 });

  data.pipe(tmpStream);
  await Promise.race([awaitEvent(data, 'end'), awaitEvent(data, 'error')]);
  tmpStream.close();

  const targetDirName = path.basename(`${namespace}.${extensionName}`);

  return { tmpZipFile, targetDirName };
}

function openZipStream (zipFile, entry) {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error, stream) => {
      if (error) {
        reject(error);
      } else {
        resolve(stream);
      }
    });
  });
}

function modeFromEntry (entry) {
  const attr = entry.externalFileAttributes >> 16 || 33188;

  return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
    .map((mask) => attr & mask)
    .reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
}

function createZipFile (zipFilePath) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
      }
      resolve(zipfile);
    });
  });
}

function unzipFile (dist, targetDirName, tmpZipFile) {
  const sourcePathRegex = new RegExp('^extension');
  return new Promise(async (resolve, reject) => {
    try {
      const extensionDir = path.join(dist, targetDirName);
      // 创建插件目录
      await fs.mkdirp(extensionDir);

      const zipFile = await createZipFile(tmpZipFile);
      zipFile.readEntry();
      zipFile.on('error', (e) => {
        reject(e);
      });

      zipFile.on('close', () => {
        if (!fs.pathExistsSync(path.join(extensionDir, 'package.json'))) {
          reject(`Download Error: ${extensionDir}/package.json`);
          return;
        }
        fs.remove(tmpZipFile).then(() => resolve(extensionDir));
      });

      zipFile.on('entry', (entry) => {
        if (!sourcePathRegex.test(entry.fileName)) {
          zipFile.readEntry();
          return;
        }
        let fileName = entry.fileName.replace(sourcePathRegex, '');

        if (/\/$/.test(fileName)) {
          const targetFileName = path.join(extensionDir, fileName);
          fs.mkdirp(targetFileName).then(() => zipFile.readEntry());
          return;
        }

        let originalFileName;
        // 在Electron中，如果解包的文件中存在.asar文件，会由于Electron本身的bug导致无法对.asar创建writeStream
        // 此处先把.asar文件写到另外一个目标文件中，完成后再进行重命名
        if (fileName.endsWith('.asar') && this.options.isElectronEnv) {
          originalFileName = fileName;
          fileName += '_prevent_bug';
        }
        const readStream = openZipStream(zipFile, entry);
        const mode = modeFromEntry(entry);
        readStream.then((stream) => {
          const dirname = path.dirname(fileName);
          const targetDirName = path.join(extensionDir, dirname);
          if (targetDirName.indexOf(extensionDir) !== 0) {
            throw new Error(`invalid file path ${targetDirName}`);
          }
          const targetFileName = path.join(extensionDir, fileName);

          fs.mkdirp(targetDirName).then(() => {
            const writerStream = fs.createWriteStream(targetFileName, { mode });
            writerStream.on('close', () => {
              if (originalFileName) {
                // rename .asar, if filename has been modified
                fs.renameSync(targetFileName, path.join(extensionDir, originalFileName));
              }
              zipFile.readEntry();
            });
            stream.on('error', (err) => {
              throw err;
            });
            stream.pipe(writerStream);
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
  const res = await urllib.request(`${api}${path}`, {
    dataType: 'json',
    timeout: 100000,
  });
  if (res.data.files && res.data.files.download) {
    const { targetDirName, tmpZipFile } = await downloadExtension(res.data.files.download, namespace, name);
    // 解压插件
    await unzipFile(targetDir, targetDirName, tmpZipFile);
    rimraf.sync(tmpZipFile);
  }
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
