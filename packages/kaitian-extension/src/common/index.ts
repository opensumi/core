import { Disposable, IJSONSchema, IDisposable, Deferred, localize, Event, Uri, MaybePromise } from '@ali/ide-core-common';
import { createExtHostContextProxyIdentifier, ProxyIdentifier } from '@ali/ide-connection';
import { ExtHostStorage } from '../hosted/api/vscode/ext.host.storage';
import { Extension } from '../hosted/vscode.extension';
import { Emitter, IExtensionProps } from '@ali/ide-core-common';
import { IExtensionContributions } from './vscode';
import { IKaitianExtensionContributions } from './kaitian/extension';
import { ActivatedExtension, ExtensionsActivator, ActivatedExtensionJSON } from './activator';

export { IExtensionProps } from '@ali/ide-core-common';

export * from './ext.host.proxy';

export interface IExtensionMetaData {
  id: string;
  extensionId: string;
  // 支持使用自定义uri
  path: string;
  uri?: Uri;
  packageJSON: { [key: string]: any };
  defaultPkgNlsJSON: { [key: string]: any } | undefined;
  packageNlsJSON: { [key: string]: any } | undefined;
  extraMetadata: JSONType;
  realPath: string; // 真实路径，用于去除symbolicLink
  extendConfig: JSONType;
  isBuiltin: boolean;
  isDevelopment?: boolean;
}

export interface IExtraMetaData {
  [key: string]: any;
}

export const ExtensionNodeServiceServerPath = 'ExtensionNodeServiceServerPath';

export type ExtensionDependencies = (string | { [extensionId: string]: string })[];

export interface ExtraMetaData {
  [key: string]: any;
}

export interface ICreateProcessOptions {
  /**
   * 启用插件进程的 Debug 模式
   */
  enableDebugExtensionHost?: boolean;
}

export const IExtensionNodeService = Symbol('IExtensionNodeService');
export interface IExtensionNodeService {
  initialize(): Promise<void>;
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]>;
  createProcess(clientId: string, options?: ICreateProcessOptions): Promise<void>;
  ensureProcessReady(clientId: string): Promise<boolean>;
  getElectronMainThreadListenPath(clientId: string);
  getElectronMainThreadListenPath2(clientId: string);
  getExtServerListenPath(clientId: string);
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined>;
  setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService);
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void>;
  disposeAllClientExtProcess(): Promise<void>;
  tryEnableInspectPort(clientId: string, delay?: number): Promise<boolean>;
  getProcessInspectPort(clientId: string): Promise<number | undefined>;
}

export const IExtensionNodeClientService = Symbol('IExtensionNodeClientService');
export interface IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string>;
  getAllExtensions(scan: string[], extensionCandidate: string[], localization: string, extraMetaData: ExtraMetaData): Promise<IExtensionMetaData[]>;
  createProcess(clientId: string, options: ICreateProcessOptions): Promise<void>;
  getExtension(extensionPath: string, localization: string, extraMetaData?: ExtraMetaData): Promise<IExtensionMetaData | undefined>;
  infoProcessNotExist(): void;
  infoProcessCrash(): void;
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void>;
  updateLanguagePack(languageId: string, languagePackPath: string, storagePath: string): Promise<void>;
}

export type ExtensionHostType = 'node' | 'worker';

export interface ChangeExtensionOptions {
  upgrade: boolean;
  extensionPath: string;
  oldExtensionPath?: string;
  isBuiltin?: boolean;
}

export abstract class ExtensionService {

  abstract async executeExtensionCommand(command: string, args: any[]): Promise<void>;
  /**
   *
   * @param command command id
   * @param targetHost 目标插件进程的位置，默认 'node' // TODO worker中的声明未支持，
   */
  abstract declareExtensionCommand(command: string, targetHost?: ExtensionHostType): IDisposable;
  abstract getExtensionCommand(command: string): ExtensionHostType | undefined;
  abstract async activate(): Promise<void>;
  abstract async activeExtension(extension: IExtension): Promise<void>;
  abstract async getProxy<T>(identifier: ProxyIdentifier): Promise<T>;
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
  abstract getExtensionProps(extensionPath: string, extraMetaData?: ExtraMetaData): Promise<IExtensionProps | undefined>;
  abstract getAllExtensionJson(): Promise<IExtensionProps[]>;
  abstract async postChangedExtension(options: ChangeExtensionOptions): Promise<void>;
  abstract async postChangedExtension(upgrade: boolean, extensionPath: string, oldExtensionPath?: string): Promise<void>;
  abstract async postChangedExtension(upgrade: boolean | ChangeExtensionOptions, extensionPath?: string, oldExtensionPath?: string): Promise<void>;
  abstract async isExtensionRunning(extensionPath: string): Promise<boolean>;
  abstract async postDisableExtension(extensionPath: string): Promise<void>;
  abstract async postEnableExtension(extensionPath: string): Promise<void>;
  abstract async postUninstallExtension(path: string): Promise<void>;
  abstract getExtensions(): IExtension[];
  abstract async activateExtensionByExtPath(extensionPath: string): Promise<void>;
  abstract registerShadowRootBody(id: string, body: HTMLElement): void;
  abstract getShadowRootBody(id: string): HTMLElement | undefined;
  abstract registerPortalShadowRoot(extensionId: string): void;
  abstract getPortalShadowRoot(extensionId: string): ShadowRoot | undefined;
  abstract async initKaitianBrowserAPIDependency(extension: IExtension): Promise<void>;

  abstract getExtensionByExtId(dep: string): IExtension | undefined;

  abstract getActivatedExtensions(): Promise<{ [key in ExtensionHostType]?: ActivatedExtension[] }>;

  onDidExtensionActivated: Event<IExtensionProps>;
  eagerExtensionsActivated: Deferred<void>;
}

export abstract class ExtensionCapabilityRegistry {
  abstract async getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export interface JSONType { [key: string]: any; }

export interface IExtension extends IExtensionProps {
  readonly contributes: IExtensionContributions & IKaitianExtensionContributions;
  activate(visited?: Set<string>);
  toJSON(): IExtensionProps;
}

//  VSCode Types
export abstract class VSCodeContributePoint<T extends JSONType = JSONType> extends Disposable {
  constructor(
    protected json: T,
    protected contributes: any,
    protected extension: IExtensionMetaData,
    protected packageNlsJSON: JSONType | undefined,
    protected defaultPkgNlsJSON: JSONType | undefined,
  ) {
    super();
  }
  schema?: IJSONSchema;

  abstract async contribute();

  protected getLocalizeFromNlsJSON(title: string) {
    const nlsRegex = /^%([\w\d.-]+)%$/i;
    const result = nlsRegex.exec(title);
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

export interface IExtensionHost {
  $activateExtension(id: string): Promise<void>;
  $initExtensions(): Promise<void>;
  $getActivatedExtensions(): Promise<ActivatedExtensionJSON[]>;

  getExtensionExports(id: string): any;
  getExtensions(): Extension[];
  getExtension(extensionId: string): Extension<any, IExtensionHost> | undefined;
  isActivated(id: string): boolean;
  activateExtension(id: string): Promise<void>;
  extensionsChangeEmitter: Emitter<void>;
  storage: ExtHostStorage;
}

export interface IExtensionHostService extends IExtensionHost {
  $fireChangeEvent(): Promise<void>;
  init(): Promise<void>;
  close(): Promise<void>;
  getExtendExports(id: string): any;
  extensionsActivator: ExtensionsActivator;
}

// tslint:disable-next-line: no-empty-interface
export interface IExtensionWorkerHost extends IExtensionHost {
  staticServicePath: string;
}

export interface IExtendProxy {
  [key: string]: any;
}

export const WorkerHostAPIIdentifier = {
  ExtWorkerHostExtensionService: createExtHostContextProxyIdentifier('ExtWorkerHostExtensionService'),
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

export enum ExtensionHostKind {
  NODE_HOST = 1,
  WORKER_HOST = 2,
}

export const ExtensionHostProfilerServicePath = 'ExtensionHostProfilerService';

export const ExtensionHostProfilerServiceToken = Symbol('ExtensionHostProfilerService');

export interface IExtensionHostProfilerService {
  $startProfile(clientId: string): Promise<void>;
  $stopProfile(clientId: string): Promise<boolean>;
  $saveLastProfile(filePath: string): Promise<void>;
}

export enum OutputType {
  STDOUT,
  STDERR,
}

export interface Output { type: OutputType; data: string; format: string[]; }

export const IExtensionHostManager = Symbol('IExtensionHostManager');

export interface IExtensionHostManager {
  init(): MaybePromise<void>;
  fork(modulePath: string, ...args: any[]): MaybePromise<number>;
  send(pid: number, message: string): MaybePromise<void>;
  isRunning(pid: number): MaybePromise<boolean>;
  treeKill(pid: number): MaybePromise<void>;
  kill(pid: number, signal?: string): MaybePromise<void>;
  isKilled(pid: number): MaybePromise<boolean>;
  findDebugPort(startPort: number, giveUpAfter: number, timeout: number): Promise<number>;
  onOutput(pid: number, listener: (output: Output) => void): MaybePromise<void>;
  onExit(pid: number, listener: (code: number, signal: string) => void): MaybePromise<void>;
  onMessage(pid: number, listener: (msg: any) => void): MaybePromise<void>;
  disposeProcess(pid: number): MaybePromise<void>;
  dispose(): MaybePromise<void>;
}
