import { Injectable, Autowired } from '@ali/common-di';
import * as compressing from 'compressing';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IExtensionManagerServer, PREFIX } from '../common';
import * as urllib from 'urllib';
import { AppConfig, URI, INodeLogger, isElectronEnv} from '@ali/ide-core-node';
import * as contentDisposition from 'content-disposition';
import * as awaitEvent from 'await-event';
import { renameSync } from 'fs-extra';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  async search(query: string) {
    return await this.request(`search?query=${query}`);
  }
  async getExtensionFromMarketPlace(extensionId: string) {
    return await this.request(`extension/${extensionId}`);
  }

  /**
   * 请求下载插件接口
   * @param extensionId 插件 id
   */
  async requestExtension(extensionId: string, version?: string): Promise<urllib.HttpClientResponse<NodeJS.ReadWriteStream>> {
    const request = await urllib.request<NodeJS.ReadWriteStream>(this.getApi(`download/${extensionId}${version ? `?version=${version}` : ''}`), {
      streaming: true,
      headers: this.getHeaders(),
    });
    return request;
  }

  /**
   * 通过插件 id 下载插件
   * @param extensionId 插件 id
   */
  async downloadExtension(extensionId: string, version?: string): Promise<string> {
    const request = await this.requestExtension(extensionId, version);

    // 获取插件文件名
    const disposition = contentDisposition.parse(request.headers['content-disposition']);
    const extensionDirName = path.basename(disposition.parameters.filename, '.zip');

    return await this.uncompressExtension(request.res, extensionDirName);
  }

  /**
   * 更新插件
   * @param extensionId 插件 id
   * @param version 要更新的版本
   * @param oldExtensionPath 更新后需要卸载之前的插件
   */
  async updateExtension(extensionId: string, version: string, oldExtensionPath: string): Promise<boolean> {
    // 先下载插件
    await this.downloadExtension(extensionId, version);
    // 卸载之前的插件
    return await this.uninstallExtension(oldExtensionPath);
  }

  /**
   * 解压插件
   * @param source 来源 stream
   * @param extensionDirName 插件文件夹名
   */
  private async uncompressExtension(source: any, extensionDirName: string): Promise<string> {
    let root: string;
    const zipStream = new compressing.zip.UncompressStream({ source });
    // 插件目录
    const extensionDir = path.join(this.appConfig.marketplace.extensionDir, extensionDirName);
    // 创建插件目录
    await fs.mkdirp(extensionDir);

    zipStream.on('entry', async (header, stream, next) => {
        if (header.type === 'directory') {
          // mac 打包后会生成一个已文件夹名命名的目录
          if (/^((?!\/).)*\/$/.test(header.name)) {
            root = header.name;
          }
          next();
        } else {
          // 说明是 vsix 类型的目录
          if (header.name === 'extension.vsixmanifest') {
            root = 'extension/';
          }
          if (!root) {
            next();
          } else {
            // 说明进入了插件目录
            if (header.name.startsWith(root)) {
              // 去除插件目录
              const fileName = header.name.replace(root, '');
              let distFile = path.join(extensionDir, fileName);

              if (fileName.endsWith('.asar') && isElectronEnv()) {
                // 在Electron中，如果解包的文件中存在.asar文件，会由于Electron本身的bug导致无法对.asar创建writeStream
                // 此处先把.asar文件写到另外一个目标文件中，完成后再进行重命名
                const originalDistFile = distFile;
                distFile += '_prevent_bug';
                stream.on('end', () => {
                  renameSync(distFile, originalDistFile);
                });
              }

              // 创建目录
              await fs.mkdirp(path.dirname(distFile));
              stream.on('end', () => {
                next();
              });
              stream.pipe(fs.createWriteStream(distFile));
            } else {
              next();
            }
          }
        }
    });

    try {
      await Promise.race([awaitEvent(zipStream, 'finish'), awaitEvent(zipStream, 'error')]);
    } catch (err) {
      this.logger.error(err);
    }
    return extensionDir;
  }

  /**
   * 卸载插件
   * @TODO 卸载不直接从文件系统删除插件，而是使用存放变量来判断是否卸载 @蛋总
   * @param extensionId 插件 id
   * @param version 插件版本
   */
  async uninstallExtension(extensionPath: string) {
    try {
      await fs.remove(extensionPath);
      return true;
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  /**
   * 请求插件市场
   * @param path 请求路径
   */
  async request(path: string) {
    try {
      const url = this.getApi(path);
      this.logger.log(`request: ${url}`);
      const res = await urllib.request(url, {
        dataType: 'json',
        timeout: 5000,
        headers: this.getHeaders(),
      });
      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error(`请求错误, status code:  ${res.status}, error: ${res.data.error}`);
      }
    } catch (err) {
      this.logger.error(err);
      throw new Error(err.message);
    }

  }

  private getApi(path: string) {
    const uri = new URI(this.appConfig.marketplace.endpoint);
    return decodeURIComponent(uri.withPath(`${PREFIX}${path}`).toString());
  }

  /**
   * 获取 headers
   */
  private getHeaders() {
    return {
      'x-account-id': this.appConfig.marketplace.accountId,
      'x-master-key': this.appConfig.marketplace.masterKey,
    };
  }

  /**
   * 是否显示插件市场
   */
  isShowBuiltinExtensions(): boolean {
    return this.appConfig.marketplace.showBuiltinExtensions;
  }
}
