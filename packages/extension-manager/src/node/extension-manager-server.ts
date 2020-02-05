import { Injectable, Autowired } from '@ali/common-di';
import * as fs from 'fs-extra';
import * as path from 'path';
import { IExtensionManagerServer, PREFIX, RequestHeaders, BaseExtension, IExtensionManager, IExtensionManagerRequester } from '../common';
import * as urllib from 'urllib';
import { AppConfig, URI, INodeLogger, isElectronEnv} from '@ali/ide-core-node';
import * as pkg from '@ali/ide-core-node/package.json';
import * as qs from 'querystring';
import { ExtensionInstaller } from '@ali/ide-extension-installer';

@Injectable()
export class ExtensionManagerRequester implements IExtensionManagerRequester {

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private headers: RequestHeaders;

  /**
   * 请求插件市场
   * @param path 请求路径
   */
  async request<T = any>(path: string, options?: urllib.RequestOptions): Promise<urllib.HttpClientResponse<T>> {
    const url = this.getApi(path);
    this.logger.log(`marketplace request url: ${url}`);
    return await urllib.request<T>(url, {
      ...options,
      headers: {
        'x-framework-version': pkg.version,
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

  setHeaders(headers: RequestHeaders): void {
    this.headers = {
      ...this.headers,
      ...headers,
    };
  }

  getHeaders() {
    return this.headers;
  }
}

@Injectable()
export class ExtensionManager implements IExtensionManager {

  @Autowired(IExtensionManagerRequester)
  extensionManagerRequester: IExtensionManagerRequester;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private installer: ExtensionInstaller;

  constructor() {
    this.installer = new ExtensionInstaller({
      accountId: this.appConfig.marketplace.accountId,
      masterKey: this.appConfig.marketplace.masterKey,
      api: this.appConfig.marketplace.endpoint,
      isElectronEnv: isElectronEnv(),
      frameworkVersion: pkg.version,
      request: {
        headers: this.extensionManagerRequester.getHeaders(),
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
      },
    });
  }

  async installExtension(extension: BaseExtension, version?: string | undefined): Promise<string> {
    const currentVersion = version || extension.version;
    const extensionDirName = `${extension.publisher}.${extension.name}-${currentVersion}`;
    const dist = await this.getUnpressExtensionDir(extensionDirName, extension);
    return this.installer.install({
      publisher: extension.publisher,
      name: extension.name,
      version: currentVersion,
      dist,
    });
  }
  async updateExtension(extension: BaseExtension, version: string): Promise<string> {
    // 先下载插件
    const extensionDir = await this.installExtension(extension, version);
    // 卸载之前的插件
    await this.uninstallExtension(extension);
    return extensionDir;
  }
  async uninstallExtension(extension: BaseExtension): Promise<boolean> {
    try {
      await fs.remove(extension.path);
      return true;
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  protected async getUnpressExtensionDir(extensionDirName: string, extension: BaseExtension): Promise<string> {
    return path.join(this.appConfig.marketplace.extensionDir, extensionDirName);
  }
}

@Injectable()
export class ExtensionManagerServer implements IExtensionManagerServer {

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(IExtensionManager)
  extensionManager: IExtensionManager;

  @Autowired(IExtensionManagerRequester)
  extensionManagerRequester: IExtensionManagerRequester;

  async search(query: string, ignoreId: string[] = []) {
    const ignoreIdList = [...ignoreId, ...this.appConfig.marketplace.ignoreId].map((id) => `&ignoreId=${id}`).join('');
    try {
      const res = await this.extensionManagerRequester.request(`search?query=${query}${ignoreIdList}`, {
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
  async getExtensionFromMarketPlace(extensionId: string, version?: string) {
    try {
      const res = await this.extensionManagerRequester.request(`extension/${extensionId}${version ? `?version=${version}` : ''}`, {
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

  async getHotExtensions(ignoreId: string[] = [], pageIndex = 1) {
    const query = {
      ignoreId: [...ignoreId, ...this.appConfig.marketplace.ignoreId],
      pageIndex,
    };
    try {
      const res = await this.extensionManagerRequester.request(`hot?${qs.stringify(query)}`, {
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

  /**
   * 通过插件 id 下载插件
   * @param extension 插件
   */
  async installExtension(extension: BaseExtension, version?: string): Promise<string> {
    return await this.extensionManager.installExtension(extension, version);
  }

  /**
   * 更新插件
   * @param extension 插件
   * @param version 要更新的版本
   */
  async updateExtension(extension: BaseExtension, version: string): Promise<string> {
    return await this.extensionManager.updateExtension(extension, version);
  }

  /**
   * 卸载插件
   * @param extension 插件
   */
  async uninstallExtension(extension: BaseExtension) {
    return await this.extensionManager.uninstallExtension(extension);
  }

  /**
   * 是否显示插件市场
   */
  isShowBuiltinExtensions(): boolean {
    return this.appConfig.marketplace.showBuiltinExtensions;
  }

  setHeaders(headers: RequestHeaders) {
    this.extensionManagerRequester.setHeaders(headers);
  }
}
