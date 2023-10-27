import { Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { createExtHostContextProxyIdentifier } from '@opensumi/ide-connection';
import {
  LifeCyclePhase,
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
  WithEventBus,
  IAppLifeCycleService,
  AppLifeCycleServiceToken,
  Emitter,
  IExtensionProps,
  IExtensionsSchemaService,
  LinkedText,
  URI,
  createLocalizedStr,
  Throttler,
} from '@opensumi/ide-core-common';
import { typeAndModifierIdPattern } from '@opensumi/ide-theme/lib/common/semantic-tokens-registry';
import { IconType, IIconService, ThemeType } from '@opensumi/ide-theme/lib/common/theme.service';
import { ContextKeyExpression } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

import { ExtHostStorage } from '../hosted/api/vscode/ext.host.storage';
import { Extension } from '../hosted/vscode.extension';

import { ActivatedExtension, ExtensionsActivator, ActivatedExtensionJSON } from './activator';
import { ISumiExtensionContributions } from './sumi/extension';
import { IExtensionContributions, IExtensionLanguagePack, IMainThreadCommands } from './vscode';
import { ThemeIcon } from './vscode/ext-types';

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
   * 调试插件进程的 Host 地址
   */
  inspectExtensionHost?: string;
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
  getElectronMainThreadListenPath(clientId: string): Promise<string>;
  getElectronMainThreadListenPath2(clientId: string): Promise<string>;
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
  setupNLSConfig(languageId: string, storagePath: string): Promise<void>;
  getOpenVSXRegistry(): Promise<string>;
  getLanguagePack(languageId: string): IExtensionLanguagePack | undefined;
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

  abstract runExtensionContributes(): Promise<void>;

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

const VAR_REGEXP = /^\$\(([a-z.]+\/)?([a-z-]+)(~[a-z]+)?\)$/i;

export interface ContributesMap<T> {
  extensionId: string;
  contributes: T;
}

export abstract class VSCodeContributePoint<T extends JSONType = JSONType> extends Disposable {
  protected contributesMap: Array<ContributesMap<T>> = [];

  protected contributedMap: Array<ContributesMap<T>> = [];

  static schema: IJSONSchema;

  protected readonly iconService?: IIconService;

  abstract contribute(): void | Promise<void>;

  register(extensionId: string, contributes: T) {
    this.contributesMap.push({ extensionId, contributes });
  }

  hasUncontributedPoint() {
    return this.contributesMap.length > 0;
  }

  afterContribute() {
    this.contributedMap = this.contributedMap.concat(this.contributesMap);
    this.contributesMap = [];
  }

  protected toIconClass(
    iconContrib: { [index in ThemeType]: string } | string,
    type: IconType = IconType.Mask,
    basePath: string,
  ): string | undefined {
    if (typeof iconContrib === 'string' && VAR_REGEXP.test(iconContrib)) {
      return this.iconService?.fromString(iconContrib);
    }
    return this.iconService?.fromIcon(basePath, iconContrib, type);
  }

  protected getLocalizeFromNlsJSON(title: string, extensionId: string, languageId?: string): string {
    return replaceNlsField(title, extensionId, title, languageId);
  }

  protected createLocalizedStr(title: string, extensionId: string) {
    return createLocalizedStr(title, extensionId, title, undefined, 'default');
  }
}

export abstract class ExtensionContributesService extends WithEventBus {
  abstract ContributionPoints: (typeof VSCodeContributePoint)[];

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(AppLifeCycleServiceToken)
  private lifecycleService: IAppLifeCycleService;

  @Autowired(IExtensionsSchemaService)
  private readonly extensionsSchemaService: IExtensionsSchemaService;

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  private contributedSet = new Set();
  private contributeQueue = new Throttler();
  private lifecycles: LifeCyclePhase[] = [];

  private getContributionCls(contributesName: string): typeof VSCodeContributePoint | undefined {
    const Constructor = this.ContributionPoints.find((Constructor) => {
      const k = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, Constructor);
      if (k === contributesName) {
        return true;
      }
      return false;
    });
    return Constructor;
  }

  register(extensionId: string, contrib: JSONType) {
    for (const k of Object.keys(contrib)) {
      const Constructor = this.getContributionCls(k);
      if (Constructor) {
        const instance = this.injector.get(Constructor);
        instance?.register(extensionId, contrib[k]);
      }
    }
  }

  private async runContributesByPhase(lifeCyclePhase: LifeCyclePhase) {
    const Contributes = this.ContributionPoints.filter((Constructor) => {
      const phase = Reflect.getMetadata(LIFE_CYCLE_PHASE_KEY, Constructor);
      const contributeName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, Constructor);
      if (phase <= lifeCyclePhase && !this.contributedSet.has(contributeName)) {
        this.contributedSet.add(contributeName);
        return true;
      }
      return false;
    });
    await Promise.all(
      Contributes.map(async (Constructor: typeof VSCodeContributePoint) => {
        try {
          const contributePoint: VSCodeContributePoint = this.injector.get(Constructor);
          const contributeName = Reflect.getMetadata(CONTRIBUTE_NAME_KEY, Constructor);
          this.addDispose(contributePoint);

          if (contributePoint.hasUncontributedPoint()) {
            const now = Date.now();
            await contributePoint.contribute();
            contributePoint.afterContribute();

            this.extensionsSchemaService.registerExtensionPoint({
              extensionPoint: contributeName,
              jsonSchema: Constructor.schema || {},
              frameworkKind: ['vscode', 'opensumi'],
            });

            const end = Date.now() - now;
            this.logger.log(`run extension contribute ${contributeName}: ${end} ms`);
          }
        } catch (e) {
          this.logger.error(e);
        }
      }),
    );
  }

  public initialize() {
    return new Promise<void>((resolve) => {
      const doRunContributes = async () => {
        const phases = this.lifecycles.slice(0);
        this.lifecycles = [];
        if (phases.length === 0) {
          return;
        }
        for (const phase of phases) {
          // 所有 contributionPoint 运行完后清空
          // 确保后续安装/启用插件后可以正常激活
          if (phase === LifeCyclePhase.Ready) {
            this.contributedSet.clear();
          }
          await this.runContributesByPhase(phase);
          if (phase === LifeCyclePhase.Initialize) {
            // 返回 Promise，说明此时初始化已完成
            resolve();
          }
        }
      };

      const runContributes = async (phase: LifeCyclePhase = this.lifecycleService.phase) => {
        this.lifecycles.push(phase);
        this.contributeQueue.queue(doRunContributes);
      };

      this.addDispose(
        this.lifecycleService.onDidLifeCyclePhaseChange((newPhase) => {
          runContributes(newPhase);
        }),
      );
      // 由于渲染上是异步调用，故 Browser 层可能比 Node 层更快的执行到后续生命周期
      // 同时，重启流程触发时也需要完整执行所有生命周期贡献点
      if (this.lifecycleService.phase === LifeCyclePhase.Ready) {
        runContributes(LifeCyclePhase.Initialize);
        runContributes(LifeCyclePhase.Starting);
        runContributes(LifeCyclePhase.Ready);
      } else if (this.lifecycleService.phase === LifeCyclePhase.Starting) {
        runContributes(LifeCyclePhase.Initialize);
        runContributes(LifeCyclePhase.Starting);
      } else {
        runContributes();
      }
    });
  }
}

export const CONTRIBUTE_NAME_KEY = 'contribute_name';
export function Contributes(name) {
  return (target) => {
    Reflect.defineMetadata(CONTRIBUTE_NAME_KEY, name, target);
  };
}

export const LIFE_CYCLE_PHASE_KEY = 'phase';
export function LifeCycle(name: LifeCyclePhase) {
  return (target) => {
    Reflect.defineMetadata(LIFE_CYCLE_PHASE_KEY, name, target);
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

export const enum ExtensionContributePoint {
  Terminal = 'terminal',
}

// #region Walkthroughs
export interface IWalkthrough {
  id: string;
  title: string;
  description: string;
  order: number;
  source: string;
  isFeatured: boolean;
  next?: string;
  when: ContextKeyExpression;
  steps: IWalkthroughStep[];
  icon: { type: 'icon'; icon: ThemeIcon } | { type: 'image'; path: string };
}

export type IWalkthroughLoose = Omit<IWalkthrough, 'steps'> & {
  steps: (Omit<IWalkthroughStep, 'description'> & { description: string })[];
};

export interface IWalkthroughStep {
  id: string;
  title: string;
  description: LinkedText[];
  category: string;
  when: ContextKeyExpression;
  order: number;
  completionEvents: string[];
  media:
    | { type: 'image'; path: { hcDark: URI; hcLight: URI; light: URI; dark: URI }; altText: string }
    | { type: 'svg'; path: URI; altText: string }
    | { type: 'markdown'; path: URI; base: URI; root: URI };
}

export interface StepProgress {
  done: boolean;
}

export interface IResolvedWalkthroughStep extends IWalkthroughStep, StepProgress {}

export namespace CompletionEventsType {
  export const onLink = 'onLink';
  export const onEvent = 'onEvent';
  export const onView = 'onView';
  export const onSettingChanged = 'onSettingChanged';
  export const onContext = 'onContext';
  export const onStepSelected = 'onStepSelected';
  export const stepSelected = 'stepSelected';
  export const onCommand = 'onCommand';
  export const onExtensionInstalled = 'onExtensionInstalled';
  export const extensionInstalled = 'extensionInstalled';
}
// #endregion Walkthroughs
