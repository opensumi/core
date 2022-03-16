import { Autowired, Injectable } from '@opensumi/di';
import { getPreferenceLanguageId } from '@opensumi/ide-core-browser';
import { ILogger, WithEventBus } from '@opensumi/ide-core-common';

import {
  AbstractExtensionManagementService,
  ChangeExtensionOptions,
  ExtensionNodeServiceServerPath,
  IExtensionNodeClientService,
  IExtensionProps,
  IExtraMetaData,
} from '../common';

import { Extension } from './extension';
import { AbstractExtInstanceManagementService, ExtensionDidEnabledEvent, ExtensionDidUninstalledEvent } from './types';

/**
 * 为插件市场面板提供数据/交互
 */
@Injectable()
export class ExtensionManagementService extends WithEventBus implements AbstractExtensionManagementService {
  @Autowired(AbstractExtInstanceManagementService)
  private readonly extInstanceManagementService: AbstractExtInstanceManagementService;

  @Autowired(ExtensionNodeServiceServerPath)
  private readonly extensionNodeClient: IExtensionNodeClientService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  /**
   * 通过 extensionPath 获取插件实例序列化数据及从 node 层获取的 extraMetadata
   */
  public async getExtensionProps(
    extensionPath: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionProps | undefined> {
    const extensionMetaData = await this.extensionNodeClient.getExtension(
      extensionPath,
      getPreferenceLanguageId(),
      extraMetaData,
    );
    if (extensionMetaData) {
      const extension = this.getExtensionByPath(extensionPath);
      if (extension) {
        return {
          ...extension.toJSON(),
          extraMetadata: extensionMetaData.extraMetadata,
        };
      }
    }
  }

  /**
   * 通过 extensionPath 获取插件实例
   */
  public getExtensionByPath(extensionPath: string) {
    return this.extInstanceManagementService.getExtensionInstances().find((ext) => extensionPath === ext.path);
  }

  /**
   * 通过 extension id 获取插件实例
   */
  public getExtensionByExtId(extensionId: string) {
    return this.extInstanceManagementService.getExtensionInstances().find((ext) => extensionId === ext.id);
  }

  /**
   * 安装插件之后开始激活
   */
  public async postChangedExtension(options: ChangeExtensionOptions): Promise<void>;
  public async postChangedExtension(upgrade: boolean, path: string, oldExtensionPath?: string): Promise<void>;
  public async postChangedExtension(
    _upgrade: boolean | ChangeExtensionOptions,
    path?: string,
    _oldExtensionPath?: string,
  ) {
    const { upgrade, extensionPath, oldExtensionPath, isBuiltin } =
      typeof _upgrade === 'boolean'
        ? {
            upgrade: _upgrade,
            extensionPath: path!,
            oldExtensionPath: _oldExtensionPath,
            isBuiltin: false,
          }
        : _upgrade;

    // 如果已经加载了一个 id 一样的插件，则不激活当前插件
    const sameExtension = this.extInstanceManagementService.getExtensionInstanceByPath(extensionPath);
    if (sameExtension) {
      this.logger.warn(`Extension ${sameExtension.id} already exists, skip activate`);
      return;
    }

    const extensionInstance = await this.extInstanceManagementService.createExtensionInstance(
      extensionPath,
      !!isBuiltin,
    );
    if (extensionInstance) {
      if (upgrade) {
        this.disableExtension(oldExtensionPath!);
      }

      return await this.enableExtension(extensionInstance);
    }
  }

  /**
   * 启用插件
   */
  public async postEnableExtension(extensionPath: string) {
    const extensionInstance = await this.extInstanceManagementService.getExtensionInstanceByPath(extensionPath);
    if (extensionInstance) {
      return await this.enableExtension(extensionInstance);
    }
  }

  /**
   * 禁用插件
   */
  public async postDisableExtension(extensionPath: string) {
    return this.disableExtension(extensionPath);
  }

  /**
   * 卸载插件
   */
  public async postUninstallExtension(extensionPath: string) {
    return this.uninstallExtension(extensionPath);
  }

  /**
   * @deprecated 建议直接用 AbstractExtInstanceManagementService#getExtensionInstances 后自行 map#toJSON 即可
   */
  public getAllExtensionJson(): IExtensionProps[] {
    // 备注: 这里的 getAllExtensions 跟 extensionMap 没有关系
    // 且 extensionMap 只在 start/restart 时设值
    // await this.getAllExtensions();
    return this.extInstanceManagementService.getExtensionInstances().map((extension) => extension.toJSON());
  }

  /**
   * 通过 extensionPath 来禁用插件
   */
  private disableExtension(extensionPath: string): void {
    const extension = this.extInstanceManagementService.getExtensionInstanceByPath(extensionPath);
    if (extension) {
      extension.disable();
      this.extInstanceManagementService.deleteExtensionInstanceByPath(extensionPath);
    }
  }

  /**
   * 激活插件实例
   */
  private async enableExtension(extension: Extension): Promise<void> {
    this.extInstanceManagementService.addExtensionInstance(extension);
    extension.enable();
    await extension.contributeIfEnabled();
    this.eventBus.fire(new ExtensionDidEnabledEvent(extension.toJSON()));
  }

  /**
   * 通过 extensionPath 来卸载插件
   */
  private async uninstallExtension(extensionPath: string) {
    const oldExtension = this.extInstanceManagementService.getExtensionInstanceByPath(extensionPath);
    if (oldExtension) {
      oldExtension.dispose();
      this.extInstanceManagementService.deleteExtensionInstanceByPath(extensionPath);
    }

    this.eventBus.fire(new ExtensionDidUninstalledEvent());
  }
}
