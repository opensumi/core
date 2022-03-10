import os from 'os';
import path from 'path';
import { Readable } from 'stream';

import fs from 'fs-extra';
import nodeFetch from 'node-fetch';
import requestretry from 'requestretry';
import { v4 as uuidv4 } from 'uuid';
import yauzl from 'yauzl';

import { Injectable, Autowired } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-node';

import { IVSXExtensionBackService, IExtensionInstallParam } from '../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../common/vsx-registry-types';

const commonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

function openZipStream(zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Readable | undefined> {
  return new Promise((resolve, reject) => {
    zipFile.openReadStream(entry, (error?: Error, stream?: Readable) => {
      if (error) {
        reject(error);
      } else {
        resolve(stream);
      }
    });
  });
}

function modeFromEntry(entry: yauzl.Entry): number {
  const attr = entry.externalFileAttributes >> 16 || 33188;

  return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
    .map((mask) => attr & mask)
    .reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
}

function createZipFile(zipFilePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
      }
      resolve(zipfile);
    });
  });
}

function cleanup(paths: string[]) {
  return Promise.all(paths.map((path) => fs.remove(path)));
}

@Injectable()
export class VSXExtensionService implements IVSXExtensionBackService {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  async getExtension(param: QueryParam): Promise<QueryResult | undefined> {
    const uri = `${this.appConfig.marketplace.endpoint}/-/query`;
    const res = await nodeFetch(uri, {
      headers: {
        ...commonHeaders,
      },
      method: 'POST',
      body: JSON.stringify(param),
    });
    return res.json();
  }

  async install(param: IExtensionInstallParam): Promise<string> {
    const { downloadPath } = await this.downloadExtension(param);
    const distPath = path.join(this.appConfig.marketplace.extensionDir, param.id + '-' + param.version);
    const targetPath = await this.uncompressFile(distPath, downloadPath);
    cleanup([downloadPath]);
    return targetPath;
  }

  private async uncompressFile(distPath: string, downloadPath: string) {
    const sourcePathRegex = new RegExp('^extension');
    return new Promise<string>(async (resolve, reject) => {
      try {
        // 创建插件目录
        await fs.mkdirp(distPath);
        const zipFile = await createZipFile(downloadPath);
        zipFile.readEntry();
        zipFile.on('error', (e) => {
          reject(e);
        });

        zipFile.on('close', () => {
          if (!fs.pathExistsSync(path.join(distPath, 'package.json'))) {
            reject(`Download Error: ${distPath}/package.json`);
            return;
          }
          fs.remove(downloadPath).then(() => resolve(distPath));
        });
        zipFile.on('entry', (entry) => {
          if (!sourcePathRegex.test(entry.fileName)) {
            zipFile.readEntry();
            return;
          }
          let fileName = entry.fileName.replace(sourcePathRegex, '');
          if (/\/$/.test(fileName)) {
            const targetFileName = path.join(distPath, fileName);
            fs.mkdirp(targetFileName).then(() => zipFile.readEntry());
            return;
          }

          let originalFileName;
          // 在Electron中，如果解包的文件中存在.asar文件，会由于Electron本身的bug导致无法对.asar创建writeStream
          // 此处先把.asar文件写到另外一个目标文件中，完成后再进行重命名
          if (fileName.endsWith('.asar')) {
            originalFileName = fileName;
            fileName += '_prevent_bug';
          }
          const readStream = openZipStream(zipFile, entry);
          const mode = modeFromEntry(entry);
          readStream.then((stream) => {
            const dirname = path.dirname(fileName);
            const targetDirName = path.join(distPath, dirname);
            if (targetDirName.indexOf(distPath) !== 0) {
              throw new Error(`invalid file path ${targetDirName}`);
            }
            const targetFileName = path.join(distPath, fileName);
            fs.mkdirp(targetDirName).then(() => {
              const writerStream = fs.createWriteStream(targetFileName, { mode });
              writerStream.on('close', () => {
                if (originalFileName) {
                  // rename .asar, if filename has been modified
                  fs.renameSync(targetFileName, path.join(distPath, originalFileName));
                }
                zipFile.readEntry();
              });
              stream?.on('error', (err) => {
                throw err;
              });
              stream?.pipe(writerStream);
            });
          });
        });
      } catch (err) {
        reject(err);
      }
    });
  }
  private async downloadExtension({ url, name, id }): Promise<{ downloadPath: string }> {
    const extensionDir = path.join(os.tmpdir(), 'extension', uuidv4());
    await fs.mkdirp(extensionDir);
    const vsixFileName = id + '.vsix';
    const downloadPath = path.join(extensionDir, vsixFileName);

    return new Promise((resolve, reject) => {
      requestretry(
        url,
        {
          method: 'GET',
          maxAttempts: 5,
          retryDelay: 2000,
          retryStrategy: requestretry.RetryStrategies.HTTPOrNetworkError,
        },
        (err, response) => {
          if (err) {
            reject(err);
          } else if (response && response.statusCode === 404) {
            reject();
          } else if (response && response.statusCode !== 200) {
            reject(new Error(response.statusMessage));
          }
        },
      )
        .pipe(fs.createWriteStream(downloadPath))
        .on('error', reject)
        .on('close', () => resolve({ downloadPath }));
    });
  }

  async search(param?: VSXSearchParam): Promise<VSXSearchResult> {
    const uri = `${this.appConfig.marketplace.endpoint}/-/search?query=${param?.query}`;
    const res = await nodeFetch(uri, {
      headers: {
        ...commonHeaders,
      },
      timeout: 30000,
    });
    return res.json();
  }
}
