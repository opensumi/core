import { Injectable, Autowired } from '@ali/common-di';
import { DebugSession, DebugState } from './debug-session';
import { WaitUntilEvent, Emitter, Event, URI, IContextKey, DisposableCollection, IContextKeyService, formatLocalize, Uri, IReporterService, uuid } from '@ali/ide-core-browser';
import { BreakpointManager } from './breakpoint/breakpoint-manager';
import { DebugConfiguration, DebugError, IDebugServer, DebugServer, DebugSessionOptions, InternalDebugSessionOptions, DEBUG_REPORT_NAME, IDebugSessionManager } from '../common';
import { DebugStackFrame } from './model/debug-stack-frame';
import { IMessageService } from '@ali/ide-overlay';
import { IVariableResolverService } from '@ali/ide-variable';
import { DebugThread } from './model/debug-thread';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { DebugSessionContributionRegistry, DebugSessionFactory } from './debug-session-contribution';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { DebugModelManager } from './editor/debug-model-manager';
import { ITaskService } from '@ali/ide-task/lib/common';
import { isRemoteAttach } from './debugUtils';

// tslint:disable-next-line:no-empty-interface
export interface WillStartDebugSession extends WaitUntilEvent {
}

export interface WillResolveDebugConfiguration extends WaitUntilEvent {
  debugType: string;
}

export interface DidChangeActiveDebugSession {
  previous: DebugSession | undefined;
  current: DebugSession | undefined;
}

export interface DebugSessionCustomEvent {
  readonly body?: any;
  readonly event: string;
  readonly session: DebugSession;
}

/**
 * 埋点专用的额外数据
 */
interface DebugBaseExtra {

  /**
   * adapterID 区分语言
   */
  adapterID: string;

  /**
   * request 区分 attach 或 launch
   */
  request: 'attach' | 'launch';

  /**
   * 跟 sessionId 一一对应，先于 sessionId 生成，可以跟踪初始化时的事件
   */
  traceId: string;

  /**
   * 是否为远程调试
   * 0: 非远程
   * 1: 远程
   */
  remote: 0 | 1;
}
interface DebugSessionExtra extends DebugBaseExtra {
  threads: Map<string, DebugThreadExtra>;
}

interface DebugThreadExtra extends DebugBaseExtra {
  threadId?: string;

  /**
   * 当前的用户操作
   */
  action?: string;

  /**
   * 文件所在的路径和行号
   */
  filePath?: string;
  fileLineNumber?: number;
}

@Injectable()
export class DebugSessionManager implements IDebugSessionManager {
  protected readonly _uid = uuid();
  protected readonly _sessions = new Map<string, DebugSession>();
  protected readonly _extraMap = new Map<string, DebugSessionExtra>();
  protected _actionIndex = 0;

  protected readonly onWillStartDebugSessionEmitter = new Emitter<WillStartDebugSession>();
  readonly onWillStartDebugSession: Event<WillStartDebugSession> = this.onWillStartDebugSessionEmitter.event;

  protected readonly onWillResolveDebugConfigurationEmitter = new Emitter<WillResolveDebugConfiguration>();
  readonly onWillResolveDebugConfiguration: Event<WillResolveDebugConfiguration> = this.onWillResolveDebugConfigurationEmitter.event;

  protected readonly onDidCreateDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidCreateDebugSession: Event<DebugSession> = this.onDidCreateDebugSessionEmitter.event;

  protected readonly onDidStartDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidStartDebugSession: Event<DebugSession> = this.onDidStartDebugSessionEmitter.event;

  protected readonly onDidStopDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidStopDebugSession: Event<DebugSession> = this.onDidStopDebugSessionEmitter.event;

  protected readonly onDidChangeActiveDebugSessionEmitter = new Emitter<DidChangeActiveDebugSession>();
  readonly onDidChangeActiveDebugSession: Event<DidChangeActiveDebugSession> = this.onDidChangeActiveDebugSessionEmitter.event;

  protected readonly onDidDestroyDebugSessionEmitter = new Emitter<DebugSession>();
  readonly onDidDestroyDebugSession: Event<DebugSession> = this.onDidDestroyDebugSessionEmitter.event;

  protected readonly onDidReceiveDebugSessionCustomEventEmitter = new Emitter<DebugSessionCustomEvent>();
  readonly onDidReceiveDebugSessionCustomEvent: Event<DebugSessionCustomEvent> = this.onDidReceiveDebugSessionCustomEventEmitter.event;

  protected readonly onDidChangeEmitter = new Emitter<DebugSession | undefined>();
  readonly onDidChange: Event<DebugSession | undefined> = this.onDidChangeEmitter.event;
  protected fireDidChange(current: DebugSession | undefined): void {
    this.inDebugModeKey.set(this.inDebugMode);
    this.onDidChangeEmitter.fire(current);
  }

  protected debugTypeKey: IContextKey<string>;
  protected inDebugModeKey: IContextKey<boolean>;
  protected debugStopped: IContextKey<boolean>;

  @Autowired(LabelService)
  labelProvider: LabelService;

  @Autowired(IContextKeyService)
  contextKeyService: IContextKeyService;

  @Autowired(DebugSessionContributionRegistry)
  protected readonly sessionContributionRegistry: DebugSessionContributionRegistry;

  @Autowired(DebugSessionFactory)
  protected readonly debugSessionFactory: DebugSessionFactory;

  @Autowired(IDebugServer)
  protected readonly debug: DebugServer;

  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(IMessageService)
  messageService: IMessageService;

  @Autowired(IVariableResolverService)
  variableResolver: IVariableResolverService;

  @Autowired(BreakpointManager)
  protected readonly breakpoints: BreakpointManager;

  @Autowired(DebugModelManager)
  protected readonly modelManager: DebugModelManager;

  @Autowired(ITaskService)
  protected readonly taskService: ITaskService;

  @Autowired(IReporterService)
  protected readonly reporterService: IReporterService;

  constructor() {
    this.init();
  }

  protected init(): void {
    this.debugTypeKey = this.contextKeyService.createKey<string>('debugType', undefined);
    this.inDebugModeKey = this.contextKeyService.createKey<boolean>('inDebugMode', this.inDebugMode);
    this.debugStopped = this.contextKeyService.createKey<boolean>('debugStopped', false);

    this.modelManager.onModelChanged((event) => {
      const { newModelUrl } = event;
      if (newModelUrl) {
        const uri = URI.parse(newModelUrl.toString());
        const model = this.modelManager.model;
        if (this.currentSession && this.currentThread && model) {
          const frame = this.currentThread.frames.find(
            (f) => f.source?.uri.toString() === uri.toString());
          if (frame && frame !== this.currentFrame) {
            this.currentThread.currentFrame = frame;
            setTimeout(() => {
              if (this.workbenchEditorService.currentEditor) {
                this.workbenchEditorService.currentEditor.monacoEditor.revealLineInCenter(frame.raw.line);
              }
            }, 0);
          }
        }
      }
    });
  }

  private _getExtra(sessionId: string | undefined, threadId: number | string | undefined): DebugThreadExtra | undefined {
    if (sessionId == null) {
      return;
    }
    const data = this._extraMap.get(sessionId);
    if (data) {
      return {
        traceId: data.traceId,
        remote: data.remote,
        adapterID: data.adapterID,
        request: data.request,
        ...threadId && data.threads.get(`${threadId}`),
      };
    }
  }

  private _setExtra(sessionId: string, threadId: string, extra?: DebugThreadExtra) {
    const data = this._extraMap.get(sessionId);
    if (!data) {
      return;
    }
    if (extra) {
      data.threads.set(threadId, extra);
    } else {
      data.threads.delete(threadId);
    }
  }

  report(name: string, msg: string | undefined, extra?: any) {
    extra = {
      traceId: this._uid,
      ...this._getExtra(extra?.sessionId, extra?.threadId),
      ...extra,
    };
    return this.reporterService.point(name, msg, extra);
  }

  reportTime(name: string, defaults?: any) {
    const timer = this.reporterService.time(name);
    return (msg: string | undefined, extra?: any) => {
      extra = {
        ...defaults,
        ...extra,
      };
      extra = {
        traceId: this._uid,
        ...this._getExtra(extra?.sessionId, extra?.threadId),
        ...extra,
      };
      return timer.timeEnd(msg, extra);
    };
  }

  reportAction(sessionId: string, threadId: number | string | undefined, action: string) {
    let extra = this._getExtra(sessionId, threadId);
    if (!extra) {
      // session 不存在，忽略
      return;
    }
    if (threadId && !extra.threadId) {
      extra = {
        ...extra,
      };
    }
    this._actionIndex += 1;
    extra.action = `${action}-${this._actionIndex}`;

    // 记录被暂停的文件路径和行号
    extra.filePath = this.currentFrame?.raw.source?.path;
    extra.fileLineNumber = this.currentFrame?.raw.line;
    this._setExtra(sessionId, `${threadId ?? ''}`, extra);
  }

  async start(options: DebugSessionOptions): Promise<DebugSession | undefined> {
    const { configuration } = options;
    const extra: DebugSessionExtra = {
      adapterID: configuration.type,
      request: configuration.request === 'launch' ? 'launch' : 'attach',
      traceId: this._uid,
      remote: 0,
      threads: new Map(),
    };
    if (isRemoteAttach(configuration)) {
      extra.remote = 1;
    }
    this.report(DEBUG_REPORT_NAME.DEBUG_BREAKPOINT, 'number', {
      count: this.breakpoints.getBreakpoints().length,
      ...extra,
    });
    if (!options.configuration.__restart) {
      if (this.isExistedDebugSession(options)) {
        this.messageService.error(formatLocalize('debug.launch.existed', options.configuration.name));
        return;
      }
    }
    try {
      const timeStart = this.reportTime(DEBUG_REPORT_NAME.DEBUG_SESSION_START_TIME, extra);
      await this.fireWillStartDebugSession();
      const resolved = await this.resolveConfiguration(options);
      if (resolved.configuration.preLaunchTask) {
        const workspaceFolderUri = Uri.parse(resolved.workspaceFolderUri!);
        const task = await this.taskService.getTask(workspaceFolderUri, resolved.configuration.preLaunchTask);
        if (task) {
          const timeTask = this.reportTime(DEBUG_REPORT_NAME.DEBUG_PRE_LAUNCH_TASK_TIME, extra);
          const result = await this.taskService.run(task);
          if (result.exitCode !== 0) {
            this.messageService.error(`The preLaunchTask ${resolved.configuration.preLaunchTask} exitCode is ${result.exitCode}`);
          }
          timeTask(workspaceFolderUri.toString(), {
            exitCode: result.exitCode,
          });
        }
      }
      const sessionId = await this.debug.createDebugSession(resolved.configuration);
      timeStart(resolved.configuration.type, {
        adapterID: resolved.configuration.type,
        request: resolved.configuration.request,
        sessionId,
      });
      if (!sessionId) {
        this.messageService.error(`The debug session type "${resolved.configuration.type}" is not supported.`);
        return;
      }
      return this.doStart(sessionId, resolved, extra);
    } catch (e) {
      if (DebugError.NotFound.is(e)) {
        this.messageService.error(`The debug session type "${e.data.type}" is not supported.`);
        return;
      }

      this.messageService.error('There was an error starting the debug session, check the logs for more details.');
      throw e;
    }
  }

  async fireWillStartDebugSession(): Promise<void> {
    await WaitUntilEvent.fire(this.onWillStartDebugSessionEmitter, {});
  }

  protected configurationIds = new Map<string, number>();
  async resolveConfiguration(options: Readonly<DebugSessionOptions>): Promise<InternalDebugSessionOptions> {
    if (InternalDebugSessionOptions.is(options)) {
      return options;
    }
    const { workspaceFolderUri, index, noDebug, parentSession, repl } = options;
    // TODO：当前调试配置均通过配置全量透传的方式进行解析，更合理的方式应该通过一个configProviderHandle来进行provider的匹配
    const resolvedConfiguration = await this.resolveDebugConfiguration(options.configuration, workspaceFolderUri);
    let configuration = await this.variableResolver.resolve(resolvedConfiguration, {});
    configuration = await this.resolveDebugConfigurationWithSubstitutedVariables(configuration, workspaceFolderUri);
    const key = configuration.name + workspaceFolderUri;
    const id = this.configurationIds.has(key) ? this.configurationIds.get(key)! + 1 : 0;
    this.configurationIds.set(key, id);
    return {
      id,
      configuration,
      workspaceFolderUri,
      index,
      noDebug,
      parentSession,
      repl,
    };
  }

  async resolveDebugConfiguration(configuration: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration> {
    await this.fireWillResolveDebugConfiguration(configuration.type);
    return this.debug.resolveDebugConfiguration(configuration, workspaceFolderUri);
  }

  protected async resolveDebugConfigurationWithSubstitutedVariables(configuration: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration> {
    await this.fireWillResolveDebugConfiguration(configuration.type);
    return this.debug.resolveDebugConfigurationWithSubstitutedVariables(configuration, workspaceFolderUri);
  }

  async fireWillResolveDebugConfiguration(debugType: string): Promise<void> {
    await WaitUntilEvent.fire(this.onWillResolveDebugConfigurationEmitter, { debugType });
  }

  protected async doStart(sessionId: string, options: DebugSessionOptions, extra: DebugSessionExtra): Promise<DebugSession> {
    const contrib = this.sessionContributionRegistry.get(options.configuration.type);
    const sessionFactory = contrib ? contrib.debugSessionFactory() : this.debugSessionFactory;
    const session = sessionFactory.get(sessionId, options);
    this._sessions.set(sessionId, session);
    this._extraMap.set(sessionId, extra);

    this.debugTypeKey.set(session.configuration.type);
    this.onDidCreateDebugSessionEmitter.fire(session);

    let state = DebugState.Inactive;
    session.onDidChange(() => {
      if (state !== session.state) {
        state = session.state;
        if (state === DebugState.Stopped) {
          this.onDidStopDebugSessionEmitter.fire(session);
          this.debugStopped.set(true);
        } else {
          this.debugStopped.set(false);
        }
      }
    });
    session.on('terminated', (event) => {
      const restart = event.body && event.body.restart;
      if (restart) {
        this.doRestart(session, restart);
      } else {
        session.terminate();
      }
    });
    session.on('exited', () => this.destroy(session.id));
    session.start().then(() => this.onDidStartDebugSessionEmitter.fire(session));
    session.onDidCustomEvent(({ event, body }) =>
      this.onDidReceiveDebugSessionCustomEventEmitter.fire({ event, body, session }),
    );

    this.updateCurrentSession(session);
    return session;
  }

  protected isExistedDebugSession(options: DebugSessionOptions): boolean {
    const { name } = options.configuration;
    for (const [, session] of this._sessions) {
      if (session.configuration.name === name && !session.terminated) {
        return true;
      }
    }
    return false;
  }

  restart(): Promise<DebugSession | undefined>;
  restart(session: DebugSession): Promise<DebugSession>;
  async restart(session: DebugSession | undefined = this.currentSession): Promise<DebugSession | undefined> {
    return session && this.doRestart(session);
  }
  protected async doRestart(session: DebugSession, restart?: any): Promise<DebugSession | undefined> {
    if (await session.restart()) {
      return session;
    }
    await session.terminate(true);
    const { options, configuration } = session;
    configuration.__restart = restart;
    return this.start(options);
  }
  protected updateCurrentSession(session: DebugSession | undefined) {
    this.currentSession = session || this.sessions[0];
  }

  get inDebugMode(): boolean {
    return this.state > DebugState.Inactive;
  }

  get currentThread(): DebugThread | undefined {
    const session = this.currentSession;
    return session && session.currentThread;
  }

  get state(): DebugState {
    const session = this.currentSession;
    return session ? session.state : DebugState.Inactive;
  }

  get currentFrame(): DebugStackFrame | undefined {
    const { currentThread } = this;
    return currentThread && currentThread.currentFrame;
  }
  get topFrame(): DebugStackFrame | undefined {
    const { currentThread } = this;
    return currentThread && currentThread.topFrame;
  }

  getSession(sessionId: string | undefined): DebugSession | undefined {
    if (sessionId) {
      return this._sessions.get(sessionId);
    }
    return undefined;
  }

  get sessions(): DebugSession[] {
    return Array.from(this._sessions.values()).filter((session) => session.state > DebugState.Inactive);
  }

  protected _currentSession: DebugSession | undefined;
  protected readonly toDisposeOnCurrentSession = new DisposableCollection();
  get currentSession(): DebugSession | undefined {
    return this._currentSession;
  }
  set currentSession(current: DebugSession | undefined) {
    if (this._currentSession === current) {
      return;
    }
    this.toDisposeOnCurrentSession.dispose();
    const previous = this._currentSession;
    this._currentSession = current;
    this.onDidChangeActiveDebugSessionEmitter.fire({ previous, current });
    if (current) {
      this.toDisposeOnCurrentSession.push(current.onDidChange(() => {
        if (this.currentFrame === this.topFrame) {
          this.open();
        }
        this.fireDidChange(current);
      }));
    }
    this.open();
    this.fireDidChange(current);
  }

  open(): void {
    const { currentFrame } = this;
    if (currentFrame) {
      currentFrame.open();
    }
  }

  /**
   * 根据sessionId销毁进程
   * @param sessionId
   */
  destroy(sessionId?: string): void {
    if (sessionId) {
      const session = this._sessions.get(sessionId);
      if (session) {
        this.doDestroy(session);
      }
    } else {
      this._sessions.forEach((session) => this.doDestroy(session));
    }
  }

  private doDestroy(session: DebugSession): void {
    this.debug.terminateDebugSession(session.id);

    this.remove(session.id);
    session.dispose();
    this.onDidDestroyDebugSessionEmitter.fire(session);
  }

  protected remove(sessionId: string): void {
    this._sessions.delete(sessionId);
    const { currentSession } = this;
    if (currentSession && currentSession.id === sessionId) {
      this.updateCurrentSession(undefined);
    }
    // server 有可能会先返回一个 exited 事件，导致 destroy 先触发
    // 包一个 setTimeout 等埋点上报后再清理
    setTimeout(() => {
      this._extraMap.delete(sessionId);
    });
  }
}
