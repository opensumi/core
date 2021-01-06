import { BasicEvent } from '../event-bus';
import { Uri } from '../uri'

export class ExtensionCandiDate {
  path: string;
  isBuiltin: boolean;
  isDevelopment: boolean;
}

/**
 * 将插件路径转换为 ExtensionCandidate 对象
 * @param extensionPath 插件路径
 * @param isDevelopment 是否为开发模式下加载的插件
 */
export function asExtensionCandidate(extensionPath: string, isDevelopment: boolean = false): ExtensionCandiDate {
  return { path: extensionPath, isBuiltin: true, isDevelopment };
}

export interface JSONType { [key: string]: any; }

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
  readonly extensionLocation: Uri
  workerVarId?: string;
  workerScriptPath?: string;
}

export class ExtensionEnabledEvent extends BasicEvent<IExtensionProps> {}

export interface IExtensionActivateEventPayload {
  topic: string;
  data?: any;
}

export class ExtensionActivateEvent extends BasicEvent<IExtensionActivateEventPayload> {}
