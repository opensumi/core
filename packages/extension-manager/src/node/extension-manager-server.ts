import { Injectable, Autowired } from '@ali/common-di';
import * as compressing from 'compressing';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IExtensionManagerServer } from '../common';
import * as urllib from 'urllib';
import { AppConfig, URI, INodeLogger} from '@ali/ide-core-node';
import * as contentDisposition from 'content-disposition';
import * as awaitEvent from 'await-event';

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  async search(query: string) {
    return await this.request(`/api/ide/search?query=${query}`);
  }
  async getExtensionFromMarketPlace(extensionId: string) {
    return await this.request(`/api/ide/extension/${extensionId}`);
  }

  /**
   * 请求下载插件接口
   * @param extensionId 插件 id
   */
  async requestExtension(extensionId: string): Promise<urllib.HttpClientResponse<NodeJS.ReadWriteStream>> {
    const request = await urllib.request<NodeJS.ReadWriteStream>(this.getApi(`/api/ide/download/${extensionId}`), {
      streaming: true,
    });
    return request;
  }

  /**
   * 通过插件 id 下载插件
   * @param extensionId 插件 id
   */
  async downloadExtension(extensionId: string): Promise<string> {
    const request = await this.requestExtension(extensionId);

    // 获取插件文件名
    const disposition = contentDisposition.parse(request.headers['content-disposition']);
    const extensionDirName = path.basename(disposition.parameters.filename, '.zip');

    return await this.uncompressExtension(request.res, extensionDirName);
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
              const distFile = path.join(extensionDir, fileName);
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
      const res = await urllib.request(this.getApi(path), {
        dataType: 'json',
        timeout: 5000,
        headers: {
          'client-id': this.appConfig.marketplace.clientId,
        },
      });
      if (res.status === 200) {
        return res.data;
      } else {
        throw new Error('请求错误');
      }
    } catch (err) {
      this.logger.error(err);
      throw new Error(err.message);
    }

  }

  private getApi(path: string) {
    const uri = new URI(this.appConfig.marketplace.endpoint);
    return decodeURIComponent(uri.withPath(path).toString());
  }

  /**
   * 是否显示插件市场
   */
  isShowBuiltinExtensions(): boolean {
    return this.appConfig.marketplace.showBuiltinExtensions;
  }
}
