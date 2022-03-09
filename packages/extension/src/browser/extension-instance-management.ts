import { Autowired, Injectable, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  AppConfig,
  Disposable,
  getPreferenceLanguageId,
  StorageProvider,
  STORAGE_NAMESPACE,
} from '@opensumi/ide-core-browser';
import { ExtensionCandidate as ExtensionCandidate } from '@opensumi/ide-core-common';

import {
  ExtensionNodeServiceServerPath,
  EXTENSION_ENABLE,
  IExtensionMetaData,
  IExtensionNodeClientService,
} from '../common';

import { Extension } from './extension';
import { AbstractExtInstanceManagementService } from './types';

/**
 * 管理 Extension 实例相关数据
 * 负责插件实例的管理
 * - 及插件的激活/禁用等
 */
@Injectable()
export class ExtInstanceManagementService extends Disposable implements AbstractExtInstanceManagementService {
  @Autowired(StorageProvider)
  private readonly storageProvider: StorageProvider;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  private extensionMap = new Map<string, Extension>();

  public dispose() {
    this.disposeExtensionInstances();
  }

  public getExtensionInstances() {
    return Array.from(this.extensionMap.values());
  }

  public disposeExtensionInstances() {
    for (const extensionInstance of this.extensionMap.values()) {
      extensionInstance.dispose();
    }

    this.extensionMap = new Map();
  }

  public resetExtensionInstances() {
    for (const extensionInstance of this.extensionMap.values()) {
      extensionInstance.reset();
    }
  }

  public getExtensionInstanceByPath(extensionPath: string): Extension | undefined {
    return this.extensionMap.get(extensionPath);
  }

  public getExtensionInstanceByExtId(extensionId: string): Extension | undefined {
    for (const extension of this.extensionMap.values()) {
      if (extension.id === extensionId) {
        return extension;
      }
    }
  }

  public deleteExtensionInstanceByPath(extensionPath: string) {
    this.extensionMap.delete(extensionPath);
  }

  public addExtensionInstance(extension: Extension) {
    // extension.path 就是 extensionPath
    this.extensionMap.set(extension.path, extension);
  }

  /**
   * 检查插件是否激活
   */
  public async checkExtensionEnable(extension: IExtensionMetaData): Promise<boolean> {
    const [workspaceStorage, globalStorage] = await Promise.all([
      this.storageProvider(STORAGE_NAMESPACE.EXTENSIONS),
      this.storageProvider(STORAGE_NAMESPACE.GLOBAL_EXTENSIONS),
    ]);
    // 全局默认为启用
    const globalEnableFlag = globalStorage.get<number>(extension.extensionId, EXTENSION_ENABLE.ENABLE);
    // 如果 workspace 未设置则读取全局配置
    return workspaceStorage.get<number>(extension.extensionId, globalEnableFlag) === EXTENSION_ENABLE.ENABLE;
  }

  public async createExtensionInstance(
    extensionPathOrMetaData: IExtensionMetaData | string,
    isBuiltin: boolean,
    isDevelopment?: boolean,
  ): Promise<Extension | undefined> {
    const extensionMetadata: IExtensionMetaData | undefined =
      typeof extensionPathOrMetaData === 'string'
        ? await this.extensionNodeClient.getExtension(extensionPathOrMetaData, getPreferenceLanguageId(), {})
        : extensionPathOrMetaData;

    if (!extensionMetadata) {
      return;
    }

    return this.injector.get(Extension, [
      extensionMetadata,
      await this.checkExtensionEnable(extensionMetadata),
      isBuiltin ||
        (this.appConfig.extensionDir ? extensionMetadata.realPath.startsWith(this.appConfig.extensionDir) : false),
      !!isDevelopment,
    ]);
  }

  /**
   * 判断插件是否为内置插件
   */
  public checkIsBuiltin(extensionMetaData: IExtensionMetaData) {
    const extensionCandidate = this.getExtensionCandidateByPath(extensionMetaData.realPath);
    // 1. 通过路径判决是否是内置插件
    // 2. candidate 是否有  isBuiltin 标识符
    const isBuiltin =
      (this.appConfig.extensionDir ? extensionMetaData.realPath.startsWith(this.appConfig.extensionDir) : false) ||
      (extensionCandidate ? extensionCandidate.isBuiltin : false);
    return isBuiltin;
  }

  /**
   * 判断插件是否为开发模式
   */
  public checkIsDevelopment(extensionMetaData: IExtensionMetaData) {
    const extensionCandidate = this.getExtensionCandidateByPath(extensionMetaData.realPath);
    const isDevelopment = !!extensionCandidate?.isDevelopment;
    return isDevelopment;
  }

  /**
   * @param realPath extension path
   */
  private getExtensionCandidateByPath(realPath: string): ExtensionCandidate | undefined {
    return (
      this.appConfig.extensionCandidate &&
      this.appConfig.extensionCandidate.find((extension) => extension.path === realPath)
    );
  }
}
