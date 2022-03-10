import { createExtHostContextProxyIdentifier } from '@opensumi/ide-connection';
import {
  Disposable,
  IJSONSchema,
  IDisposable,
  Deferred,
  Uri,
  MaybePromise,
  IExtensionLogger,
  ExtensionConnectOption,
  replaceNlsField,
  ILogger,
} from '@opensumi/ide-core-common';
import { Emitter, IExtensionProps } from '@opensumi/ide-core-common';
import { typeAndModifierIdPattern } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';

import { ExtHostStorage } from '../hosted/api/vscode/ext.host.storage';
import { Extension } from '../hosted/vscode.extension';


import { ActivatedExtension, ExtensionsActivator, ActivatedExtensionJSON } from './activator';
import { ISumiExtensionContributions } from './sumi/extension';
import { IExtensionContributions, IMainThreadCommands } from './vscode';


export { IExtensionProps } from '@opensumi/ide-core-common';

export * from './ext.host.proxy';
export * from './require-interceptor';

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

/**
 * 提供插件扫描时的额外信息读取能力
 * 比如 read/changelog/package.nls.json 等等
 */
export interface IExtraMetaData {
  [key: string]: string;
}

export const ExtensionNodeServiceServerPath = 'ExtensionNodeServiceServerPath';

export type ExtensionDependencies = (string | { [extensionId: string]: string })[];

export interface ICreateProcessOptions {
  /**
   * 启用插件进程的 Debug 模式
   */
  enableDebugExtensionHost?: boolean;
  /**
   * 插件进程连接时候一些配置选项
   */
  extensionConnectOption?: ExtensionConnectOption;
}

export const IExtensionNodeService = Symbol('IExtensionNodeService');
export interface IExtensionNodeService {
  initialize(): Promise<void>;
  getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: IExtraMetaData,
  ): Promise<IExtensionMetaData[]>;
  createProcess(clientId: string, options?: ICreateProcessOptions): Promise<void>;
  ensureProcessReady(clientId: string): Promise<boolean>;
  getElectronMainThreadListenPath(clientId: string);
  getElectronMainThreadListenPath2(clientId: string);
  getExtServerListenOption(clientId: string);
  getExtension(
    extensionPath: string,
    localization: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionMetaData | undefined>;
  setConnectionServiceClient(clientId: string, serviceClient: IExtensionNodeClientService);
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void>;
  disposeAllClientExtProcess(): Promise<void>;
  tryEnableInspectPort(clientId: string, delay?: number): Promise<boolean>;
  getProcessInspectPort(clientId: string): Promise<number | undefined>;
}

export const IExtensionNodeClientService = Symbol('IExtensionNodeClientService');
export interface IExtensionNodeClientService {
  getElectronMainThreadListenPath(clientId: string): Promise<string>;
  getAllExtensions(
    scan: string[],
    extensionCandidate: string[],
    localization: string,
    extraMetaData: IExtraMetaData,
  ): Promise<IExtensionMetaData[]>;
  createProcess(clientId: string, options: ICreateProcessOptions): Promise<void>;
  getExtension(
    extensionPath: string,
    localization: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionMetaData | undefined>;
  infoProcessNotExist(): void;
  infoProcessCrash(): void;
  restartExtProcessByClient(): void;
  disposeClientExtProcess(clientId: string, info: boolean): Promise<void>;
  updateLanguagePack(languageId: string, languagePackPath: string, storagePath: string): Promise<void>;
}

export type ExtensionHostType = 'node' | 'worker';

export type ExtensionHostTypeUpperCase = 'Node.js' | 'Web Worker';

export interface ChangeExtensionOptions {
  upgrade: boolean;
  extensionPath: string;
  oldExtensionPath?: string;
  isBuiltin?: boolean;
}

/**
 * 管理不同进程内插件注册的 command 的运行环境及其调用
 */
export abstract class IExtCommandManagement {
  abstract registerProxyCommandExecutor(env: ExtensionHostType, proxyCommandExecutor: IMainThreadCommands): void;
  abstract executeExtensionCommand(env: ExtensionHostType, command: string, args: any[]): Promise<any>;
  /**
   * @param command command id
   * @param targetHost 目标插件进程的运行环境，默认 'node'
   */
  abstract registerExtensionCommandEnv(command: string, targetHost?: ExtensionHostType): IDisposable;
  abstract getExtensionCommandEnv(command: string): ExtensionHostType | undefined;
}

/**
 * 为插件市场面板提供数据/交互
 */
export abstract class AbstractExtensionManagementService {
  /**
   * @deprecated 建议直接用 AbstractExtInstanceManagementService#getExtensionInstances 后自行 map#toJSON 即可
   */
  abstract getAllExtensionJson(): IExtensionProps[];

  /**
   * 禁用插件
   */
  abstract postDisableExtension(extensionPath: string): Promise<void>;

  /**
   * 启用插件
   */
  abstract postEnableExtension(extensionPath: string): Promise<void>;

  /**
   * 安装插件之后开始激活
   */
  abstract postChangedExtension(options: ChangeExtensionOptions): Promise<void>;
  abstract postChangedExtension(upgrade: boolean, extensionPath: string, oldExtensionPath?: string): Promise<void>;
  abstract postChangedExtension(
    upgrade: boolean | ChangeExtensionOptions,
    extensionPath?: string,
    oldExtensionPath?: string,
  ): Promise<void>;

  /**
   * 卸载插件
   */
  abstract postUninstallExtension(extensionPath: string): Promise<void>;

  /**
   * 通过 extensionPath 获取插件实例
   */
  abstract getExtensionByPath(extensionPath: string): IExtension | undefined;
  /**
   * 通过 extension id 获取插件实例
   */
  abstract getExtensionByExtId(extensionId: string): IExtension | undefined;

  /**
   * 通过 extensionPath 获取插件实例序列化数据及从 node 层获取的 extraMetadata
   */
  abstract getExtensionProps(
    extensionPath: string,
    extraMetaData?: IExtraMetaData,
  ): Promise<IExtensionProps | undefined>;
}

export abstract class ExtensionService {
  /**
   * 激活插件服务
   */
  abstract activate(): Promise<void>;

  /**
   * 重启插件进程
   */
  abstract restartExtProcess(): Promise<void>;

  /**
   * 激活插件, 给 Extension 实例使用
   */
  abstract activeExtension(extension: IExtension): Promise<void>;

  /**
   * 销毁插件
   */
  abstract disposeExtensions(): Promise<void>;

  /**
   * 执行插件命令
   */
  abstract executeExtensionCommand(command: string, args: any[]): Promise<void>;

  /**
   * @internal 提供获取所有运行中的插件的列表数据
   */
  abstract getActivatedExtensions(): Promise<{ [key in ExtensionHostType]?: ActivatedExtension[] }>;

  eagerExtensionsActivated: Deferred<void>;
}

export abstract class ExtensionCapabilityRegistry {
  abstract getAllExtensions(): Promise<IExtensionMetaData[]>;
}

export const LANGUAGE_BUNDLE_FIELD = 'languageBundle';

export interface JSONType {
  [key: string]: any;
}

export interface IExtension extends IExtensionProps {
  readonly contributes: IExtensionContributions & ISumiExtensionContributions;
  activate(visited?: Set<string>);
  enable(): void;
  reset(): void;
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

  abstract contribute();

  protected getLocalizeFromNlsJSON(title: string): string {
    return replaceNlsField(title, this.extension.id)!;
  }
}

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}

export const EXTENSION_EXTEND_SERVICE_PREFIX = 'extension_extend_service';
export const MOCK_EXTENSION_EXTEND_PROXY_IDENTIFIER = createExtHostContextProxyIdentifier(
  'mock_extension_extend_proxy_identifier',
);

export interface IExtensionHost {
  logger: IExtensionLogger;
  $activateExtension(id: string): Promise<void>;
  /**
   * 更新插件进程内的插件相关数据
   */
  $updateExtHostData(): Promise<void>;
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
  /**
   * 上报插件未捕获异常
   * @param error
   */
  reportUnexpectedError(error: Error): void;
}

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
  id: 'sumi-extension:ext-host-event',
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

export interface Output {
  type: OutputType;
  data: string;
  format: string[];
}

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

/**
 * 以下都是 fork 新的插件子进程的时候，传入的命令行参数的 key
 */
export const KT_PROCESS_SOCK_OPTION_KEY = 'kt-process-sock-option';
export const KT_PROCESS_PRELOAD_KEY = 'kt-process-preload';
export const KT_APP_CONFIG_KEY = 'kt-app-config';

// #region Semantic Tokens Contribution Point

export interface SemanticTokenScopes {
  scopes?: { [selector: string]: string[] };
  language?: string;
}

export type SemanticTokenScopesSchema = Array<SemanticTokenScopes>;

export interface SemanticTokenType {
  id: string;
  description: string;
  superType?: string;
}

export type SemanticTokenTypeSchema = Array<SemanticTokenType>;

export interface SemanticTokenModifier {
  id: string;
  description: string;
}

export type SemanticTokenModifierSchema = Array<SemanticTokenModifier>;

export function validateTypeOrModifier(
  contribution: SemanticTokenType | SemanticTokenModifier,
  extensionPoint: string,
  logger: ILogger,
): boolean {
  if (typeof contribution.id !== 'string' || contribution.id.length === 0) {
    logger.error("'configuration.{0}.id' must be defined and can not be empty", extensionPoint);
    return false;
  }
  if (!contribution.id.match(typeAndModifierIdPattern)) {
    logger.error("'configuration.{0}.id' must follow the pattern letterOrDigit[-_letterOrDigit]*");
    return false;
  }
  const superType = (contribution as SemanticTokenType).superType;
  if (superType && !superType.match(typeAndModifierIdPattern)) {
    logger.error(
      "'configuration.{0}.superType' must follow the pattern letterOrDigit[-_letterOrDigit]*",
      extensionPoint,
    );
    return false;
  }
  if (typeof contribution.description !== 'string' || contribution.id.length === 0) {
    logger.error("'configuration.{0}.description' must be defined and can not be empty", extensionPoint);
    return false;
  }
  return true;
}

// #endregion Semantic Tokens Contribution Point
