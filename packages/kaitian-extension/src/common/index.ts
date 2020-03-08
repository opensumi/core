import { Disposable, IJSONSchema, IDisposable, ReporterProcessMessage, Deferred, localize, Event } from '@ali/ide-core-common';
import { createExtHostContextProxyIdentifier, ProxyIdentifier } from '@ali/ide-connection';
import { ExtHostStorage } from '../hosted/api/vscode/ext.host.storage';
import { VSCExtension } from '../hosted/vscode.extension';
import { ExtensionsActivator } from '../hosted/ext.host.activator';
import { Emitter } from '@ali/ide-core-common';

export interface IExtensionMetaData {
  id: string;
  extensionId: string;
  path: string;
  packageJSON: {[key: string]: any};
  deafaultPkgNlsJSON: { [key: string]: any } | undefined;
  packageNlsJSON: {[key: string]: any} | undefined;
  extraMetadata: JSONType;
  realPath: string; // 真实路径，用于去除symbolicLink
  extendConfig: JSONType;
}

export interface IExtraMetaData {
  [key: string]: any;
}

export const ExtensionNodeServiceServerPath = 'ExtensionNodeServiceServerPath';

export interface ExtraMetaData {
  [key: string]: any;
}

export const IExtensionNodeService = Symbol('IExtensionNodeService');
export interface IExtensionNodeService {
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]>;
  createProcess2(clientId: string): Promise<void>;
  getElectronMainThreadListenPath(clientId: string);
  getElectronMainThreadListenPath2(clientId: string);
  getExtServerListenPath(clientId: string);
  resolveConnection();
  resolveProcessInit();
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined>;
  setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService);
  disposeClientExtProcess(clientId: string,  info: boolean): Promise<void>;
}

export const IExtensionNodeClientService = Symbol('IExtensionNodeClientService');
export interface IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string>;
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]>;
  createProcess(clientId: string): Promise<void>;
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined>;
  infoProcessNotExist(): void;
  infoProcessCrash(): void;
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void>;
  updateLanguagePack(languageId: string, languagePackPath: string): Promise<void>;
}

export type ExtensionHostType = 'node' | 'worker';

export abstract class ExtensionService {
  abstract async executeExtensionCommand(command: string, args: any[]): Promise<void>;
  /**
   *
   * @param command command id
   * @param targetHost 目标插件进程的位置，默认 'node' // TODO worker中的声明未支持，
   */
  abstract declareExtensionCommand(command: string, targetHost?: ExtensionHostType ): IDisposable;
  abstract getExtensionCommand(command: string): ExtensionHostType | undefined;
  abstract async activate(): Promise<void>;
  abstract async activeExtension(extension: IExtension): Promise<void>;
  abstract async getProxy<T>(identifier: ProxyIdentifier<T>): Promise<T>;
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
  abstract getExtensionProps(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionProps | undefined>;
  abstract getAllExtensionJson(): Promise<IExtensionProps[]>;
  abstract async postChangedExtension(upgrade: boolean, extensionPath: string, oldExtensionPath?: string): Promise<void>;
  abstract async isExtensionRunning(extensionPath: string): Promise<boolean>;
  abstract async postDisableExtension(extensionPath: string): Promise<void>;
  abstract async postEnableExtension(extensionPath: string): Promise<void>;
  abstract async postUninstallExtension(path: string): Promise<void>;
  abstract getExtensions(): IExtension[];
  abstract async activateExtensionByExtPath(extensionPath: string): Promise<void>;
  onDidExtensionActivated: Event<IExtensionProps>;
  eagerExtensionsActivated: Deferred<void>;
}

export abstract class ExtensionCapabilityRegistry {
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export interface JSONType { [key: string]: any; }

export interface IExtensionProps {
  readonly id: string;
  // 插件市场 id
  readonly extensionId: string;
  readonly name: string;
  readonly activated: boolean;
  readonly enabled: boolean;
  readonly packageJSON: JSONType;
  readonly deafaultPkgNlsJSON: JSONType | undefined;
  readonly packageNlsJSON: JSONType | undefined;
  readonly path: string;
  readonly realPath: string;
  readonly extraMetadata: JSONType;
  readonly extendConfig: JSONType;
  readonly enableProposedApi: boolean;
  readonly isUseEnable: boolean;
  workerVarId?: string;
  workerScriptPath?: string;
  readonly isBuiltin: boolean;
}

export interface IExtension extends IExtensionProps {
  activate();
  toJSON(): IExtensionProps;
}

//  VSCode Types
export abstract class VSCodeContributePoint< T extends JSONType = JSONType > extends Disposable {
  constructor(
    protected json: T,
    protected contributes: any,
    protected extension: IExtensionMetaData,
    protected packageNlsJSON: JSONType | undefined,
    protected deafaultPkgNlsJSON: JSONType | undefined,
  ) {
    super();
  }
  schema?: IJSONSchema;

  abstract async contribute();

  protected getLocalizeFromNlsJSON(title: string) {
    const nlsRegx = /^%([\w\d.-]+)%$/i;
    const result = nlsRegx.exec(title);
    if (result) {
      return localize(result[1], undefined, this.extension.id);
    }
    return title;
  }
}

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}

export const EXTENSION_EXTEND_SERVICE_PREFIX = 'extension_extend_service';
export const MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER = createExtHostContextProxyIdentifier('mock_extension_extend_proxy_identifier');

export interface IExtensionHostService {
  reporterEmitter: Emitter<ReporterProcessMessage>;
  getExtensions(): IExtension[];
  $activateExtension(id: string): Promise<void>;
  $initExtensions(): Promise<void>;
  $fireChangeEvent(): Promise<void>;
  getExtension(extensionId: string): VSCExtension<any> | undefined;
  storage: ExtHostStorage;
  activateExtension(id: string): Promise<void>;
  getExtensionExports(id: string): any;
  getExtendExports(id: string): any;
  isActivated(id: string): boolean;
  extentionsActivator: ExtensionsActivator;
  extensionsChangeEmitter: Emitter<void>;
}

export interface IExtensionWorkerHost {
  $initExtensions(): Promise<void>;
}

export interface IExtendProxy {
  [key: string]: any;
}

export const WorkerHostAPIIdentifier = {
  ExtWorkerHostExtensionService: createExtHostContextProxyIdentifier<IExtensionWorkerHost>('ExtWorkerHostExtensionService'),
};

export enum ProcessMessageType {
  REPORTER,
}

export enum EXTENSION_ENABLE {
  ENABLE = 1,
  DISABLE = 0,
}

// 广播插件事件
export const EMIT_EXT_HOST_EVENT = {
  id: 'kaitian-extension:ext-host-event',
};

export function getExtensionId(extensionId: string) {
  return extensionId.toLowerCase();
}
