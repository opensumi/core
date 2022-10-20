import { Uri } from '@opensumi/ide-utils';

import { BasicEvent } from '../event-bus';

export class ExtensionCandidate {
  path: string;
  isBuiltin: boolean;
  isDevelopment: boolean;
}

export enum ExtensionConnectModeOption {
  'TCP',
  'IPC',
}

/**
 * 插件进程连接时候一些配置选项
 */
export interface ExtensionConnectOption {
  // 两种连接模式参考 nodejs net 模块
  mode: ExtensionConnectModeOption;
  // 如果 mode 为 TCP，字段表示套接字应连接到的主机地址，不传默认为'localhost'
  host?: string;
}

/**
 * 插件 browser 层的样式表配置项
 */
export interface ExtensionBrowserStyleSheet {
  componentUri: string;
  iconfontUri: string;
}

/**
 * 将插件路径转换为 ExtensionCandidate 对象
 * @param extensionPath 插件路径
 * @param isDevelopment 是否为开发模式下加载的插件
 */
export function asExtensionCandidate(extensionPath: string, isDevelopment = false): ExtensionCandidate {
  return { path: extensionPath, isBuiltin: true, isDevelopment };
}

export interface JSONType {
  [key: string]: any;
}

export interface IExtensionInfo {
  /**
   * package.json 里的 publisher.name
   * 用于插件之前的相互调用
   */
  readonly id: string;
  /**
   * 插件市场 id
   */
  readonly extensionId: string;
  /**
   * 是否为内置插件
   */
  readonly isBuiltin: boolean;

  /**
   * 是否为开发模式
   */
  readonly isDevelopment?: boolean;
}

export interface IExtensionProps extends IExtensionInfo {
  readonly name: string;
  readonly displayName?: string;
  readonly activated: boolean;
  readonly enabled: boolean;
  readonly packageJSON: JSONType;
  readonly defaultPkgNlsJSON: JSONType | undefined;
  readonly packageNlsJSON: JSONType | undefined;
  readonly path: string;
  readonly realPath: string;
  readonly extraMetadata: JSONType;
  readonly extendConfig: JSONType;
  readonly enableProposedApi: boolean;
  readonly isUseEnable: boolean;
  readonly extensionLocation: Uri;
  workerVarId?: string;
  workerScriptPath?: string;
}

export class ExtensionEnabledEvent extends BasicEvent<IExtensionProps> {}

export interface IExtensionActivateEventPayload {
  topic: string;
  data?: any;
}

export class ExtensionActivateEvent extends BasicEvent<IExtensionActivateEventPayload> {}

export class ExtensionDidContributes extends BasicEvent<void> {}
