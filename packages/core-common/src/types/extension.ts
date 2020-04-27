import { BasicEvent } from '../event-bus';

export class ExtensionCandiDate {
  path: string;
  isBuiltin: boolean;
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
  workerVarId?: string;
  workerScriptPath?: string;
}

export class ExtensionEnabledEvent extends BasicEvent<IExtensionProps> {}

export interface IExtensionActivateEventPayload {
  topic: string;
  data?: any;
}

export class ExtensionActivateEvent extends BasicEvent<IExtensionActivateEventPayload> {}
