import { Injectable } from '@ali/common-di';
import * as vscode from 'vscode';
import { IExtHostCommands, IExtHostDebugService, IExtensionDescription, IMainThreadDebug, ExtensionWSChannel, IExtHostConnectionService } from '../../../../common/vscode';
import { Emitter, Event, uuid, IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-common';
import { Disposable, Uri } from '../../../../common/vscode/ext-types';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier } from '../../../../common/vscode/';
import { ExtensionDebugAdapterSession } from './extension-debug-adapter-session';
import { Breakpoint, DebuggerContribution } from '../../../../common/vscode/models';
import { DebugConfiguration, DebugStreamConnection } from '@ali/ide-debug';
import { ExtensionDebugAdapterTracker } from './extension-debug-adapter-tracker';
import { connectDebugAdapter, startDebugAdapter } from './extension-debug-adapter-starter';
import { resolveDebugAdapterExecutable } from './extension-debug-adapter-excutable-resolver';
import { Path } from '@ali/ide-core-common/lib/path';
import { IExtensionHostService } from '../../../../common';
import { IExtension } from '../../../../common';

export function createDebugApiFactory(
  extensionService: IExtensionHostService,
  extHostDebugService: IExtHostDebugService,
) {

  const debug: typeof vscode.debug = {
    get activeDebugSession() {
      return extHostDebugService.activeDebugSession;
    },
    get activeDebugConsole() {
      return extHostDebugService.activeDebugConsole;
    },
    get breakpoints() {
      return extHostDebugService.breakpoints;
    },
    onDidStartDebugSession(listener, thisArg?, disposables?) {
      return extHostDebugService.onDidStartDebugSession(listener, thisArg, disposables);
    },
    onDidTerminateDebugSession(listener, thisArg?, disposables?) {
      return extHostDebugService.onDidTerminateDebugSession(listener, thisArg, disposables);
    },
    onDidChangeActiveDebugSession(listener, thisArg?, disposables?) {
      return extHostDebugService.onDidChangeActiveDebugSession(listener, thisArg, disposables);
    },
    onDidReceiveDebugSessionCustomEvent(listener, thisArg?, disposables?) {
      return extHostDebugService.onDidReceiveDebugSessionCustomEvent(listener, thisArg, disposables);
    },
    onDidChangeBreakpoints(listener, thisArgs?, disposables?) {
      return extHostDebugService.onDidChangeBreakpoints(listener, thisArgs, disposables);
    },
    registerDebugConfigurationProvider(debugType: string, provider: vscode.DebugConfigurationProvider) {
      return extHostDebugService.registerDebugConfigurationProvider(debugType, provider);
    },
    registerDebugAdapterDescriptorFactory(debugType: string, factory: vscode.DebugAdapterDescriptorFactory) {
      return extHostDebugService.registerDebugAdapterDescriptorFactory(extensionService.getExtensions(), debugType, factory);
    },
    registerDebugAdapterTrackerFactory(debugType: string, factory: vscode.DebugAdapterTrackerFactory) {
      return extHostDebugService.registerDebugAdapterTrackerFactory(debugType, factory);
    },
    startDebugging(folder: vscode.WorkspaceFolder | undefined, nameOrConfig: string | vscode.DebugConfiguration, parentSession?: vscode.DebugSession) {
      return extHostDebugService.startDebugging(folder, nameOrConfig, parentSession);
    },
    addBreakpoints(breakpoints: vscode.Breakpoint[]) {
      return extHostDebugService.addBreakpoints(breakpoints);
    },
    removeBreakpoints(breakpoints: vscode.Breakpoint[]) {
      return extHostDebugService.removeBreakpoints(breakpoints);
    },
  };

  return debug;
}

@Injectable()
export class ExtHostDebug implements IExtHostDebugService {

  private readonly onDidChangeBreakpointsEmitter = new Emitter<vscode.BreakpointsChangeEvent>();
  private readonly onDidChangeActiveDebugSessionEmitter = new Emitter<vscode.DebugSession | undefined>();
  private readonly onDidTerminateDebugSessionEmitter = new Emitter<vscode.DebugSession>();
  private readonly onDidStartDebugSessionEmitter = new Emitter<vscode.DebugSession>();
  private readonly onDidReceiveDebugSessionCustomEmitter = new Emitter<vscode.DebugSessionCustomEvent>();

  private sessions = new Map<string, ExtensionDebugAdapterSession>();
  private debuggersContributions = new Map<string, DebuggerContribution>();
  private contributionPaths = new Map<string, string>();
  private configurationProviders = new Map<string, Set<vscode.DebugConfigurationProvider>>();
  private trackerFactories: [string, vscode.DebugAdapterTrackerFactory][] = [];
  private descriptorFactories = new Map<string, vscode.DebugAdapterDescriptorFactory>();

  private proxy: IMainThreadDebug;

  activeDebugSession: vscode.DebugSession | undefined;
  breakpoints: Breakpoint[];
  activeDebugConsole: vscode.DebugConsole;

  constructor(rpc: IRPCProtocol, private extHostConnectionService: IExtHostConnectionService, private extHostCommand: IExtHostCommands) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadDebug);
    // TODO:
    // 实现debugConsole界面
  }

  // debug API
  get onDidChangeBreakpoints(): Event<vscode.BreakpointsChangeEvent> {
    return this.onDidChangeBreakpointsEmitter.event;
  }

  get onDidReceiveDebugSessionCustomEvent(): Event<vscode.DebugSessionCustomEvent> {
    return this.onDidReceiveDebugSessionCustomEmitter.event;
  }

  get onDidChangeActiveDebugSession(): Event<vscode.DebugSession | undefined> {
    return this.onDidChangeActiveDebugSessionEmitter.event;
  }

  get onDidTerminateDebugSession(): Event<vscode.DebugSession> {
    return this.onDidTerminateDebugSessionEmitter.event;
  }

  get onDidStartDebugSession(): Event<vscode.DebugSession> {
    return this.onDidStartDebugSessionEmitter.event;
  }

  /**
   * 注册贡献点
   * @param extensionPath 拓展路径
   * @param contributions 有效的贡献点
   */
  registerDebuggersContributions(extensionPath: string, contributions: DebuggerContribution[]): void {
    contributions.forEach((contribution: DebuggerContribution) => {
      this.contributionPaths.set(contribution.type, extensionPath);
      this.debuggersContributions.set(contribution.type, contribution);
      this.proxy.$registerDebuggerContribution({
        type: contribution.type,
        label: contribution.label || contribution.type,
      });
      console.log(`Debugger contribution has been registered: ${contribution.type}`);
    });
  }

  async addBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void> {
    // TODO
  }

  async removeBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void> {
    // TODO
  }

  async startDebugging(folder: vscode.WorkspaceFolder | undefined, nameOrConfig: string | vscode.DebugConfiguration, parentSession?: vscode.DebugSession): Promise<boolean> {
    // TODO
    return false;
  }

  registerDebugConfigurationProvider(type: string, provider: vscode.DebugConfigurationProvider): vscode.Disposable {
    return new Disposable(() => { });
    // TODO
  }

  registerDebugAdapterDescriptorFactory(extensions: IExtension[], type: string, factory: vscode.DebugAdapterDescriptorFactory): vscode.Disposable {
    // TODO
    return new Disposable(() => { });
  }

  public registerDebugAdapterTrackerFactory(type: string, factory: vscode.DebugAdapterTrackerFactory): vscode.Disposable {
    // TODO
    return new Disposable(() => { });
  }

  // RPC methods
  async $onSessionCustomEvent(sessionId: string, event: string, body?: any): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.onDidReceiveDebugSessionCustomEmitter.fire({ event, body, session });
    }
  }

  async $sessionDidCreate(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.onDidStartDebugSessionEmitter.fire(session);
    }
  }

  async $sessionDidDestroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.onDidTerminateDebugSessionEmitter.fire(session);
    }
  }
  async $sessionDidChange(sessionId: string | undefined): Promise<void> {
    this.activeDebugSession = sessionId ? this.sessions.get(sessionId) : undefined;
    this.onDidChangeActiveDebugSessionEmitter.fire(this.activeDebugSession);
  }

  async $breakpointsDidChange(all: Breakpoint[], added: Breakpoint[], removed: Breakpoint[], changed: Breakpoint[]): Promise<void> {
    this.breakpoints = all;
    this.onDidChangeBreakpointsEmitter.fire({ added, removed, changed });
  }

  async $createDebugSession(debugConfiguration: DebugConfiguration): Promise<string> {
    const sessionId = uuid();

    const debugSession: vscode.DebugSession = {
      id: sessionId,
      type: debugConfiguration.type,
      name: debugConfiguration.name,
      workspaceFolder: undefined,
      configuration: debugConfiguration,
      customRequest: (command: string, args?: any) => this.proxy.$customRequest(sessionId, command, args),
    };

    const tracker = await this.createDebugAdapterTracker(debugSession);
    const communicationProvider = await this.createCommunicationProvider(debugSession, debugConfiguration);

    const debugAdapterSession = new ExtensionDebugAdapterSession(communicationProvider, tracker, debugSession);
    this.sessions.set(sessionId, debugAdapterSession);

    const connection = await this.extHostConnectionService!.ensureConnection(sessionId);
    debugAdapterSession.start(new ExtensionWSChannel(connection));

    return sessionId;
  }

  async $terminateDebugSession(sessionId: string): Promise<void> {
    const debugAdapterSession = this.sessions.get(sessionId);
    if (debugAdapterSession) {
      await debugAdapterSession.stop();
      this.sessions.delete(sessionId);
    }
  }

  async $getSupportedLanguages(debugType: string): Promise<string[]> {
    const contribution = this.debuggersContributions.get(debugType);
    return contribution && contribution.languages || [];
  }

  async $getSchemaAttributes(debugType: string): Promise<IJSONSchema[]> {
    const contribution = this.debuggersContributions.get(debugType);
    return contribution && contribution.configurationAttributes || [];
  }

  async $getConfigurationSnippets(debugType: string): Promise<IJSONSchemaSnippet[]> {
    const contribution = this.debuggersContributions.get(debugType);
    return contribution && contribution.configurationSnippets || [];
  }

  async $getTerminalCreationOptions(debugType: string): Promise<undefined> {
    return this.doGetTerminalCreationOptions(debugType);
  }

  async doGetTerminalCreationOptions(debugType: string): Promise<undefined> {
    return undefined;
  }

  async $provideDebugConfigurations(debugType: string, workspaceFolderUri: string | undefined): Promise<vscode.DebugConfiguration[]> {
    let result: DebugConfiguration[] = [];

    const providers = this.configurationProviders.get(debugType);
    if (providers) {
      for (const provider of providers) {
        if (provider.provideDebugConfigurations) {
          result = result.concat(await provider.provideDebugConfigurations(this.toWorkspaceFolder(workspaceFolderUri)) || []);
        }
      }
    }

    return result;
  }

  async $resolveDebugConfigurations(debugConfiguration: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<vscode.DebugConfiguration | undefined> {
    let current = debugConfiguration;

    for (const providers of [this.configurationProviders.get(debugConfiguration.type), this.configurationProviders.get('*')]) {
      if (providers) {
        for (const provider of providers) {
          if (provider.resolveDebugConfiguration) {
            try {
              const next = await provider.resolveDebugConfiguration(this.toWorkspaceFolder(workspaceFolderUri), current);
              if (next) {
                current = next;
              } else {
                return current;
              }
            } catch (e) {
              console.error(e);
            }
          }
        }
      }
    }

    return current;
  }

  protected async createDebugAdapterTracker(session: vscode.DebugSession): Promise<vscode.DebugAdapterTracker> {
    return ExtensionDebugAdapterTracker.create(session, this.trackerFactories);
  }

  protected async createCommunicationProvider(session: vscode.DebugSession, debugConfiguration: vscode.DebugConfiguration): Promise<DebugStreamConnection> {
    const executable = await this.resolveDebugAdapterExecutable(debugConfiguration);
    const descriptorFactory = this.descriptorFactories.get(session.type);
    if (descriptorFactory) {
      // 'createDebugAdapterDescriptor' 方法会在Debug session启动时被调用，主要用于提供调试适配器需要的信息。
      // 返回的信息必须为 vscode.DebugAdapterDescriptor 类型
      // 当前支持两种调试适配器：
      // - 可以通过命令行执行特定命令的执行器，类型如 DebugAdapterExecutable
      // - 可以通过通信端口访问的适配器服务器，类型如 DebugAdapterServer
      // 如果没有实现对应方法，默认的行为如下：
      //
      //   createDebugAdapter(session: DebugSession, executable: DebugAdapterExecutable) {
      //      if (typeof session.configuration.debugServer === 'number') {
      //         return new DebugAdapterServer(session.configuration.debugServer);
      //      }
      //      return executable;
      //   }
      //  @param session The [debug session](#DebugSession) for which the debug adapter will be used.
      //  @param executable The debug adapter's executable information as specified in the package.json (or undefined if no such information exists).
      const descriptor = await descriptorFactory.createDebugAdapterDescriptor(session, executable);
      if (descriptor) {
        if ('port' in descriptor) {
          return connectDebugAdapter(descriptor);
        } else {
          return startDebugAdapter(descriptor);
        }
      }
    }

    if ('debugServer' in debugConfiguration) {
      return connectDebugAdapter({ port: debugConfiguration.debugServer });
    } else {
      if (!executable) {
        throw new Error('It is not possible to provide debug adapter executable.');
      }
      return startDebugAdapter(executable);
    }
  }

  protected async resolveDebugAdapterExecutable(debugConfiguration: vscode.DebugConfiguration): Promise<vscode.DebugAdapterExecutable | undefined> {
    const { type } = debugConfiguration;
    const contribution = this.debuggersContributions.get(type);
    if (contribution) {
      if (contribution.adapterExecutableCommand) {
        const executable = await this.extHostCommand.executeCommand<vscode.DebugAdapterExecutable>(contribution.adapterExecutableCommand);
        if (executable) {
          return executable;
        }
      } else {
        const contributionPath = this.contributionPaths.get(type);
        if (contributionPath) {
          return resolveDebugAdapterExecutable(contributionPath, contribution);
        }
      }
    }

    throw new Error(`It is not possible to provide debug adapter executable for '${debugConfiguration.type}'.`);
  }

  private toWorkspaceFolder(folder: string | undefined): vscode.WorkspaceFolder | undefined {
    if (!folder) {
      return undefined;
    }

    const uri = Uri.parse(folder);
    const path = new Path(uri.path);
    return {
      uri,
      name: path.base,
      index: 0,
    };
  }
}
