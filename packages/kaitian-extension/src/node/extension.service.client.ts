import { Injectable, Autowired } from '@ali/common-di';
import * as fs from 'fs';
import * as path from 'path';
import { uuid } from '@ali/ide-core-node';
import * as os from 'os';
import { createHash } from 'crypto';

import { ExtraMetaData, IExtensionMetaData, IExtensionNodeService, IExtensionNodeClientService } from '../common';
import { RPCService } from '@ali/ide-connection';
import * as lp from './languagePack';

export const DEFAULT_NLS_CONFIG_DIR = path.join(os.homedir(), '.kaitian');

@Injectable()
export class ExtensionSeviceClientImpl extends RPCService implements IExtensionNodeClientService {

  @Autowired(IExtensionNodeService)
  private extensionService: IExtensionNodeService;
  private clientId: string;

  public setConnectionClientId(clientId: string) {
    this.clientId = clientId;

    this.extensionService.setConnectionServiceClient(this.clientId, this);
  }

  public infoProcessNotExist() {
    if (this.rpcClient) {
      this.rpcClient[0].processNotExist(this.clientId);
    }
  }

  public infoProcessCrash() {
    if (this.rpcClient) {
      this.rpcClient[0].processCrashRestart(this.clientId);
    }
  }

  public async getElectronMainThreadListenPath(clientId: string) {
    return this.extensionService.getElectronMainThreadListenPath(clientId);
  }
  /**
   * 创建插件进程
   *
   * @param clientId 客户端 id
   */
  public async createProcess(clientId: string): Promise<void> {
    await this.extensionService.createProcess2(clientId);
  }

  /**
   * 获取插件信息
   *
   * @param extensionPath 插件路径
   * @param extraMetaData 补充数据
   */
  public async getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined> {
    return await this.extensionService.getExtension(extensionPath, localization, extraMetaData);
  }

  /**
   * 获取所有插件
   *
   * @param scan 插件存放目录
   * @param extensionCandidate 执行插件目录
   * @param extraMetaData 扫描数据字段
   */
  public async getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: { [key: string]: any } = {}): Promise<IExtensionMetaData[]> {
    return await this.extensionService.getAllExtensions(scan, extensionCandidate, localization, extraMetaData);
  }

  public async disposeClientExtProcess(clientId: string, info: boolean = true): Promise<void> {
    return await this.extensionService.disposeClientExtProcess(clientId, info);
  }

  public async updateLanguagePack(languageId: string, languagePack: string): Promise<void> {
    let languagePacks: { [key: string]: any } = {};
    if (fs.existsSync(path.join(DEFAULT_NLS_CONFIG_DIR, 'languagepacks.json'))) {
      const rawLanguagePacks = fs.readFileSync(path.join(DEFAULT_NLS_CONFIG_DIR, 'languagepacks.json')).toString();
      try {
        languagePacks = JSON.parse(rawLanguagePacks);
      } catch (err) {
        console.error(err.message);
      }
    }
    const rawPkgJson = fs.readFileSync(path.join(languagePack, 'package.json')).toString();
    const packageJson = JSON.parse(rawPkgJson);

    if (packageJson.contributes && packageJson.contributes.localizations) {
      for (const localization of packageJson.contributes.localizations) {
        const md5 = createHash('md5');
        // 这里需要添加languagePack路径作为id一部分，因为可能存在多个
        const id = `${languagePack}-${packageJson.publisher.toLocaleLowerCase()}.${packageJson.name.toLocaleLowerCase()}`;
        const _uuid = uuid();
        md5.update(id).update(packageJson.version);
        const hash = md5.digest('hex');
        languagePacks[localization.languageId] = {
          hash,
          extensions: [{
            extensionIdentifier: {
              id,
              uuid: _uuid,
            },
            version: packageJson.version,
          }],
          translations: localization.translations.reduce((pre, translation) => {
            pre[translation.id] = path.join(languagePack, translation.path);
            return pre;
          }, {}),
        };
      }
    }

    fs.writeFileSync(path.join(DEFAULT_NLS_CONFIG_DIR, 'languagepacks.json'), JSON.stringify(languagePacks));

    const nlsConfig = await lp.getNLSConfiguration('f06011ac164ae4dc8e753a3fe7f9549844d15e35', path.join(os.homedir(), '.kaitian'), languageId.toLowerCase());
    // tslint:disable-next-line: no-string-literal
    nlsConfig['_languagePackSupport'] = true;
    process.env.VSCODE_NLS_CONFIG = JSON.stringify(nlsConfig);
  }
}
