import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IMainThreadDebug, ExtHostAPIIdentifier, IExtHostDebug, ExtensionWSChannel, IMainThreadConnectionService } from '../../../common/vscode';
import { DisposableCollection, Uri, ILoggerManagerClient, ILogServiceClient, SupportLogNamespace, URI } from '@ali/ide-core-browser';
import { DebuggerDescription, IDebugService, DebugConfiguration, IDebugServer, IDebuggerContribution } from '@ali/ide-debug';
import { DebugSessionManager, BreakpointManager, DebugConfigurationManager, DebugPreferences, DebugSchemaUpdater, DebugBreakpoint, DebugSessionContributionRegistry, DebugModelManager, SourceBreakpoint } from '@ali/ide-debug/lib/browser';
import { IRPCProtocol, WSChanneHandler } from '@ali/ide-connection';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ali/ide-file-service';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMessageService } from '@ali/ide-overlay';
import { ExtensionDebugSessionFactory, ExtensionDebugSessionContributionRegistry } from './debug';
import { ExtensionDebugService } from './debug/extension-debug-service';
import { ExtensionDebugAdapterContribution } from './debug/extension-debug-adapter-contribution';
import { ActivationEventService } from '@ali/ide-activation-event';
import { Breakpoint, WorkspaceFolder } from '../../../common/vscode/models';
import { DebugProtocol } from 'vscode-debugprotocol';
import { IDebugSessionManager } from '@ali/ide-debug/lib/common/debug-session';
import { DebugConsoleSession } from '@ali/ide-debug/lib/browser/console/debug-console-session';
import { ITerminalClient } from '@ali/ide-terminal2';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';

@Injectable({ multiple: true })
export class MainThreadDebug implements IMainThreadDebug {

  private readonly toDispose = new Map<string, DisposableCollection>();

  private proxy: IExtHostDebug;

  @Autowired(IDebugSessionManager)
  protected readonly sessionManager: DebugSessionManager;

  @Autowired(LabelService)
  protected readonly labelService: LabelService;

  @Autowired(BreakpointManager)
  protected readonly breakpointManager: BreakpointManager;

  @Autowired(DebugModelManager)
  protected readonly modelManager: DebugModelManager;

  @Autowired(DebugConfigurationManager)
  protected readonly debugConfigurationManager: DebugConfigurationManager;

  @Autowired(DebugPreferences)
  protected readonly debugPreferences: DebugPreferences;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(WorkbenchEditorService)
  protected readonly editorService: WorkbenchEditorService;

  @Autowired(IMessageService)
  protected readonly messageService: IMessageService;

  @Autowired(IFileServiceClient)
  fileSystem: IFileServiceClient;

  @Autowired(WSChanneHandler)
  protected readonly connectionProvider: WSChanneHandler;

  @Autowired(IDebugServer)
  protected readonly adapterContributionRegistrator: ExtensionDebugService;

  @Autowired(ActivationEventService)
  protected readonly activationEventService: ActivationEventService;

  @Autowired(DebugSessionContributionRegistry)
  sessionContributionRegistrator: ExtensionDebugSessionContributionRegistry;

  @Autowired(ILoggerManagerClient)
  protected readonly LoggerManager: ILoggerManagerClient;
  protected readonly logger: ILogServiceClient = this.LoggerManager.getLogger(SupportLogNamespace.ExtensionHost);

  @Autowired(ITerminalClient)
  protected readonly terminalService: ITerminalClient;

  @Autowired(DebugConsoleSession)
  debugConsoleSession: DebugConsoleSession;

  @Autowired(OutputService)
  protected readonly outputService: OutputService;

  @Autowired(IDebugService)
  debugService: IDebugService;

  constructor(
    @Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol,
    @Optinal(IMainThreadConnectionService) private mainThreadConnection: IMainThreadConnectionService,
  ) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostDebug);
    this.listen();
    const debugContributionPoints = this.debugService.debugContributionPoints;
    // 需确保在贡献点注册完后执行
    // 将ContributionPoints中的debuggers数据传递给插件
    // 后续时序若发生调整，这块逻辑也需要调整
    for (const [folder, contributions] of debugContributionPoints) {
      this.proxy.$registerDebuggerContributions(folder, contributions as IDebuggerContribution[]);
      contributions.forEach((contribution: any) => {
        this.$registerDebuggerContribution({
          type: contribution.type,
          label: contribution.label || contribution.type,
        });
        this.logger.log(`Debugger contribution has been registered: ${contribution.type}`);
      });
    }
  }

  public dispose() {
    this.toDispose.forEach((disposable) => {
      disposable.dispose();
    });

    this.toDispose.clear();
  }

  listen() {
    this.breakpointManager.onDidChangeBreakpoints(({ added, removed, changed }) => {
      const all = this.breakpointManager.getBreakpoints();
      this.proxy.$breakpointsDidChange(
        this.toCustomApiBreakpoints(all),
        this.toCustomApiBreakpoints(added),
        this.toCustomApiBreakpoints(removed),
        this.toCustomApiBreakpoints(changed),
      );
    });
  }

  async $appendToDebugConsole(value: string): Promise<void> {
    this.debugConsoleSession.append(value);
  }

  async $appendLineToDebugConsole(value: string): Promise<void> {
    this.debugConsoleSession.appendLine(value);
  }

  async $registerDebuggerContribution(description: DebuggerDescription): Promise<void> {
    const disposable = new DisposableCollection();
    const terminalOptionsExt = await this.proxy.$getTerminalCreationOptions(description.type);
    this.toDispose.set(description.type, disposable);
    const debugSessionFactory = new ExtensionDebugSessionFactory(
      this.editorService,
      this.breakpointManager,
      this.modelManager,
      this.terminalService,
      this.labelService,
      this.messageService,
      this.debugPreferences,
      async (sessionId: string) => {
        const connection = await this.mainThreadConnection.ensureConnection(sessionId);
        return new ExtensionWSChannel(connection);
      },
      this.fileSystem,
      terminalOptionsExt,
      this.debugPreferences,
      this.outputService,
    );
    disposable.pushAll([
      this.adapterContributionRegistrator.registerDebugAdapterContribution(
        new ExtensionDebugAdapterContribution(description, this.proxy, this.activationEventService),
      ),
      this.sessionContributionRegistrator.registerDebugSessionContribution({
        debugType: description.type,
        debugSessionFactory: () => debugSessionFactory,
      }),
    ]);
  }

  async $unregisterDebuggerConfiguration(debugType: string): Promise<void> {
    const disposable = this.toDispose.get(debugType);
    if (disposable) {
      disposable.dispose();
      this.toDispose.delete(debugType);
    }
  }

  async $addBreakpoints(breakpoints: Breakpoint[]): Promise<void> {
    const newBreakpoints = new Map<string, Breakpoint>();
    breakpoints.forEach((b) => newBreakpoints.set(b.id, b));
    this.breakpointManager.findMarkers({
      dataFilter: (data) => {
        // 至存储未被标记的断点信息
        if (newBreakpoints.has(data.id)) {
          newBreakpoints.delete(data.id);
        }
        return false;
      },
    });
    for (const breakpoint of newBreakpoints.values()) {
      if (breakpoint.location) {
        const location = breakpoint.location;
        this.breakpointManager.addBreakpoint({
          id: breakpoint.id,
          uri: Uri.revive(location.uri).toString(),
          enabled: true,
          raw: {
            line: breakpoint.location.range.startLineNumber + 1,
            column: 1,
            condition: breakpoint.condition,
            hitCondition: breakpoint.hitCondition,
            logMessage: breakpoint.logMessage,
          },
        });
      }
    }
  }

  async $removeBreakpoints(breakpoints: Breakpoint[]): Promise<void> {
    const ids = new Set<string>();
    breakpoints.forEach((b) => ids.add(b.id));
    for (const origin of this.breakpointManager.findMarkers({ dataFilter: (data) => ids.has(data.id) })) {
      const model = this.modelManager.resolve(new URI(origin.data.uri));
      if (model && model[0].breakpoint) {
        model[0].breakpoint.remove();
      }
    }
  }

  async $customRequest(sessionId: string, command: string, args?: any): Promise<DebugProtocol.Response> {
    const session = this.sessionManager.getSession(sessionId);
    if (session) {
      return session.sendCustomRequest(command, args);
    }

    throw new Error(`Debug session '${sessionId}' not found`);
  }

  async $startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration): Promise<boolean> {
    let configuration: DebugConfiguration | undefined;

    if (typeof nameOrConfiguration === 'string') {
      for (const options of this.debugConfigurationManager.all) {
        if (options.configuration.name === nameOrConfiguration) {
          configuration = options.configuration;
        }
      }
    } else {
      configuration = nameOrConfiguration;
    }

    if (!configuration) {
      this.logger.error(`不存在配置 ${nameOrConfiguration}`);
      return false;
    }

    const session = await this.sessionManager.start({
      configuration,
      workspaceFolderUri: folder && Uri.revive(folder.uri).toString(),
    });

    return !!session;
  }

  private toCustomApiBreakpoints(sourceBreakpoints: SourceBreakpoint[]): Breakpoint[] {
    return sourceBreakpoints.map((b) => ({
      id: b.id,
      enabled: b.enabled,
      condition: b.raw.condition,
      hitCondition: b.raw.hitCondition,
      logMessage: b.raw.logMessage,
      location: {
        uri: Uri.parse(b.uri),
        range: {
          startLineNumber: b.raw.line - 1,
          startColumn: (b.raw.column || 1) - 1,
          endLineNumber: b.raw.line - 1,
          endColumn: (b.raw.column || 1) - 1,
        },
      },
    }));
  }
}
