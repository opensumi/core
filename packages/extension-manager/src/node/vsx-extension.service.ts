import os from 'os';
import path from 'path';
import { pipeline } from 'stream';

import compressing from 'compressing';
import fs from 'fs-extra';
import requestretry from 'requestretry';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { uuid } from '@opensumi/ide-core-common';
import { DEFAULT_TRS_REGISTRY } from '@opensumi/ide-core-common/lib/const';
import { AppConfig } from '@opensumi/ide-core-node/lib/types';

import {
  IVSXExtensionBackService,
  IExtensionInstallParam,
  IMarketplaceService,
  IOpentrsMarketplaceService,
  IOpenvsxMarketplaceService,
} from '../common';
import { QueryParam, QueryResult, VSXSearchParam, VSXSearchResult } from '../common/vsx-registry-types';

function cleanup(paths: string[]) {
  return Promise.all(paths.map((path) => fs.remove(path)));
}

@Injectable()
export class VSXExtensionService implements IVSXExtensionBackService {
  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private marketplace: IMarketplaceService;

  private getMarketplace() {
    if (this.marketplace) {
      return this.marketplace;
    }

    const { marketplace: marketplaceConfig } = this.appConfig;
    const { endpoint } = marketplaceConfig;

    this.marketplace =
      endpoint === DEFAULT_TRS_REGISTRY.ENDPOINT
        ? this.injector.get(IOpentrsMarketplaceService)
        : this.injector.get(IOpenvsxMarketplaceService);

    return this.marketplace;
  }

  async getExtension(param: QueryParam): Promise<QueryResult | undefined> {
    return await this.getMarketplace().getExtensionDetail(param);
  }

  async install(param: IExtensionInstallParam): Promise<string> {
    const { downloadPath } = await this.downloadExtension(param);
    const distPath = path.join(this.appConfig.marketplace.extensionDir, param.id + '-' + param.version);
    const targetPath = await this.uncompressFile(distPath, downloadPath);
    cleanup([downloadPath]);
    return targetPath;
  }

  async getOpenVSXRegistry(): Promise<string> {
    return this.appConfig.marketplace.endpoint;
  }
  // compress file with compressing module
  private async uncompressFile(distPath: string, downloadPath: string) {
    const sourcePathRegex = new RegExp('^extension');
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<string>(async (resolve, reject) => {
      try {
        await fs.mkdirp(distPath);
        const stream = new compressing.zip.UncompressStream({ source: downloadPath });
        stream
          .on('error', reject)
          .on('finish', () => {
            if (!fs.pathExistsSync(path.join(distPath, 'package.json'))) {
              reject(`Download Error: ${distPath}/package.json`);
              return;
            }
            fs.remove(downloadPath).then(() => resolve(distPath));
          })
          .on('entry', (header, stream, next) => {
            stream.on('end', next);
            if (!sourcePathRegex.test(header.name)) {
              stream.resume();
              return;
            }
            let fileName = header.name.replace(sourcePathRegex, '');
            if (/\/$/.test(fileName)) {
              const targetFileName = path.join(distPath, fileName);
              fs.mkdirp(targetFileName, (err) => {
                if (err) {
                  return reject(err);
                }
                stream.resume();
              });
              return;
            }

            let originalFileName;
            // 在 Electron 中，如果解包的文件中存在 .asar 文件，会由于 Electron 本身的 bug 导致无法对 .asar 创建 writeStream
            // 此处先把 .asar 文件写到另外一个目标文件中，完成后再进行重命名
            if (fileName.endsWith('.asar')) {
              originalFileName = fileName;
              fileName += '_prevent_bug';
            }
            const targetFileName = path.join(distPath, fileName);
            fs.mkdirp(path.dirname(targetFileName), (err) => {
              if (err) {
                return reject(err);
              }
              const writerStream = fs.createWriteStream(targetFileName, { mode: header.mode });
              writerStream.on('close', () => {
                if (originalFileName) {
                  // rename .asar, if filename has been modified
                  fs.renameSync(targetFileName, path.join(distPath, originalFileName));
                }
              });
              pipeline(stream, writerStream, (err) => {
                if (err) {
                  return reject(err);
                }
              });
            });
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  private async downloadExtension({ url, id }): Promise<{ downloadPath: string }> {
    const extensionDir = path.join(os.tmpdir(), 'extension', uuid());
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
          headers: this.getMarketplace().downloadHeaders,
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
    return await this.getMarketplace().search(param);
  }
}
