import { Injectable, Autowired } from '@ali/common-di';
import * as compressing from 'compressing';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IExtensionManagerServer, PREFIX, RequestHeaders } from '../common';
import * as urllib from 'urllib';
import { AppConfig, URI, INodeLogger, isElectronEnv, MarketplaceRequest} from '@ali/ide-core-node';
import * as contentDisposition from 'content-disposition';
import * as awaitEvent from 'await-event';
import { renameSync } from 'fs-extra';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private logger: INodeLogger;
  private headers: RequestHeaders;

  async search(query: string, ignoreId?: string[]) {
    try {
      const res = await this.request(`search?query=${query}${ignoreId ? ignoreId.map((id) => `&ignoreId=${id}`).join('') : ''}`, {
        dataType: 'json',
        timeout: 5000,
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
  async getExtensionFromMarketPlace(extensionId: string) {
    try {
      const res = await this.request(`extension/${extensionId}`, {
        dataType: 'json',
        timeout: 5000,
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

  async getHotExtensions(ignoreId?: string[]) {
    return await this.request(`hot${ignoreId ? '?' + ignoreId.map((id) => `&ignoreId=${id}`).join('') : ''}`);
  }

  /**
   * 请求下载插件接口
   * @param extensionId 插件 id
   */
  async requestExtension(extensionId: string, version?: string): Promise<urllib.HttpClientResponse<NodeJS.ReadWriteStream>> {
    const request = await this.request<NodeJS.ReadWriteStream>(`download/${extensionId}${version ? `?version=${version}` : ''}`, {
      streaming: true,
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
  async updateExtension(extensionId: string, version: string, oldExtensionPath: string): Promise<string> {
    // 先下载插件
    const extensionDir = await this.downloadExtension(extensionId, version);
    // 卸载之前的插件
    await this.uninstallExtension(oldExtensionPath);
    return extensionDir;
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
  async request<T = any>(path: string, options?: urllib.RequestOptions): Promise<urllib.HttpClientResponse<T>> {
    const url = this.getApi(path);
    return await urllib.request<T>(url, {
      ...options,
      headers: {
        'x-account-id': this.appConfig.marketplace.accountId,
        'x-master-key': this.appConfig.marketplace.masterKey,
        ...this.headers,
      },
      beforeRequest: (options) => {
        if (this.appConfig.marketplace.transformRequest) {
          const { headers, path} = this.appConfig.marketplace.transformRequest({
            path: options.path,
            headers: options.headers,
          });
          if (path) {
            options.path = path;
          }
          if (headers) {
            options.headers = headers;
          }
        }
      },
    });

  }

  private getApi(path: string) {
    const uri = new URI(this.appConfig.marketplace.endpoint);
    return decodeURIComponent(uri.withPath(`${PREFIX}${path}`).toString());
  }

  /**
   * 是否显示插件市场
   */
  isShowBuiltinExtensions(): boolean {
    return this.appConfig.marketplace.showBuiltinExtensions;
  }

  setHeaders(headers: RequestHeaders) {
    this.headers = headers;
  }
}
