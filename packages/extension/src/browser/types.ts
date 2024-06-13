import { Injectable } from '@opensumi/di';
import { BasicEvent, Event, IDisposable, IExtensionProps } from '@opensumi/ide-core-browser';

import { IExtension, IExtensionMetaData } from '../common';

import { Extension } from './extension';

export type Serializable = any;

export interface IExtHostEventPayload {
  eventName: string;
  eventArgs: Serializable[];
}

export class ExtHostEvent extends BasicEvent<IExtHostEventPayload> {}

@Injectable()
export abstract class IActivationEventService {
  abstract fireEvent(topic: string, data?: string): Promise<void>;

  abstract onEvent(event: string, listener): IDisposable;

  abstract addWildCardTopic(topic: string): IDisposable;

  activatedEventSet: Set<string>;
}

/**
 * 插件实例的数据管理
 */
export abstract class AbstractExtInstanceManagementService {
  abstract dispose(): void;

  abstract onDidChange: Event<void>;

  /**
   * 通过路径销毁插件实例 dispose
   */
  abstract disposeExtensionInstancesByPath(paths: Array<string>): void;

  /**
   * 获取所有插件实例
   */
  abstract getExtensionInstances(): Extension[];
  /**
   * 重置所有插件实例 (reset)
   */
  abstract resetExtensionInstances(): void;

  /**
   * 销毁所有插件实例 (dispose)
   */
  abstract disposeExtensionInstances(): void;

  /**
   * 通过 extension path 获取插件实例
   */
  abstract getExtensionInstanceByPath(extensionPath: string): Extension | undefined;
  /**
   * 通过 extension id 获取插件实例
   */
  abstract getExtensionInstanceByExtId(extensionId: string): Extension | undefined;
  /**
   * 删除插件实例
   */
  abstract deleteExtensionInstanceByPath(extensionPath: string): void;
  /**
   * 添加插件实例
   */
  abstract addExtensionInstance(extension: Extension): void;
  /**
   * 检查插件是否激活
   */
  abstract checkExtensionEnable(extension: IExtensionMetaData): Promise<boolean>;

  /**
   * 通过 extensionPath 创建一个 (内置) 插件实例
   */
  abstract createExtensionInstance(
    extensionPathOrMetaData: IExtensionMetaData | string,
    isBuiltin: boolean,
    isDevelopment?: boolean,
  ): Promise<Extension | undefined>;

  /**
   * 判断插件是否为内置插件
   */
  abstract checkIsBuiltin(extensionMetaData: IExtensionMetaData): boolean;
  /**
   * 判断插件是否为开发模式
   */
  abstract checkIsDevelopment(extensionMetaData: IExtensionMetaData): boolean;
}

export class ExtensionApiReadyEvent extends BasicEvent<void> {}

/**
 * 扩展被激活前的事件
 */
export class ExtensionBeforeActivateEvent extends BasicEvent<void> {}

export class ExtensionWillActivateEvent extends BasicEvent<IExtension> {}

export class ExtensionWillContributeEvent extends BasicEvent<IExtensionMetaData> {}

// 将激活的插件作为 payload 广播出去
export class ExtensionDidActivatedEvent extends BasicEvent<IExtensionProps> {}

/**
 * 插件扫描完成后的事件
 */
export class ExtensionsInitializedEvent extends BasicEvent<IExtension[]> {}

/**
 * 插件卸载时的事件
 */
export class ExtensionDidUninstalledEvent extends BasicEvent<void> {}

/**
 * 插件启用时的事件
 */
export class ExtensionDidEnabledEvent extends BasicEvent<IExtensionProps> {}

export interface IBrowserMainThreadAPI {
  setup: () => Promise<void>;
  dispose: () => void;
}
