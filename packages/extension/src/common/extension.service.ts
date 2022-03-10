import { IRPCProtocol } from '@opensumi/ide-connection/lib/common/rpcProtocol';
import { Deferred } from '@opensumi/ide-core-common';

import { ActivatedExtensionJSON } from './activator';
import type { SumiWorkerExtensionService, VSCodeExtensionService } from './vscode';

import { IExtension } from './index';

type ExtensionChangeKind = 'install' | 'uninstall' | 'upgrade' | 'enable' | 'disable';

export interface IExtensionChangeEvent {
  kind: ExtensionChangeKind;
  extension: IExtension;
}

abstract class BaseExtProcessService {
  public ready: Deferred<void>;
  abstract protocol: IRPCProtocol;
  abstract disposeApiFactory(): void;
  abstract disposeProcess(): void | Promise<void>;
  abstract activate(): Promise<IRPCProtocol>;
  abstract activeExtension(extension: IExtension, isWebExtension: boolean): Promise<void>;
}

export abstract class AbstractNodeExtProcessService<T = any>
  extends BaseExtProcessService
  implements VSCodeExtensionService
{
  /**
   * 更新插件进程中的插件列表数据
   */
  abstract updateExtensionData(extensions: IExtension[]): Promise<void>;
  abstract getExtension(extensionId: string): IExtension | undefined;
  abstract getActivatedExtensions(): Promise<ActivatedExtensionJSON[]>;

  abstract getProxy(): T | Promise<T>;

  // RPC call
  abstract $activateExtension: VSCodeExtensionService['$activateExtension'];
  abstract $getExtensions: VSCodeExtensionService['$getExtensions'];
}

// 相对 node extension service 额外增加 `$getStaticServicePath`
export abstract class AbstractWorkerExtProcessService<T = any>
  extends AbstractNodeExtProcessService<T>
  implements SumiWorkerExtensionService
{
  abstract activate(ignoreCors?: boolean): Promise<IRPCProtocol>;
  abstract $getStaticServicePath: SumiWorkerExtensionService['$getStaticServicePath'];
}

export abstract class AbstractViewExtProcessService {
  activatedViewExtensionMap: Map<string, IExtension>;

  abstract getPortalShadowRoot(extensionId: string): ShadowRoot | undefined;
  abstract activate(): void;
  abstract initExtension(extensions: IExtension[]): void;
  abstract activeExtension(extension: IExtension, protocol: IRPCProtocol): Promise<void>;
}
