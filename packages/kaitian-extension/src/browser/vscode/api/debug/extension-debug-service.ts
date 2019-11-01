import { Injectable, Autowired } from '@ali/common-di';
import { DebugServer, DebuggerDescription, DebugServerPath } from '@ali/ide-debug';
import { ExtensionDebugAdapterContribution } from './extension-debug-adapter-contribution';
import { Disposable, IDisposable, DisposableCollection, IJSONSchema, IJSONSchemaSnippet } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { WSChanneHandler } from '@ali/ide-connection';
import { ILoggerManagerClient, SupportLogNamespace, ILogServiceClient } from '@ali/ide-logs/lib/browser';
import { DebugConfiguration } from '@ali/ide-debug/lib/common/debug-configuration';

export interface ExtensionDebugAdapterContributionRegistrator {
  /**
   * 注册插件Debug Adapter贡献点
   * @param contrib
   */
  registerDebugAdapterContribution(contrib: ExtensionDebugAdapterContribution): IDisposable;

  /**
   * 注销插件Debug Adapter贡献点
   * @param debugType
   */
  unregisterDebugAdapterContribution(debugType: string): void;
}

@Injectable()
export class ExtensionDebugService implements DebugServer, ExtensionDebugAdapterContributionRegistrator {

  protected readonly contributors = new Map<string, ExtensionDebugAdapterContribution>();
  protected readonly toDispose = new DisposableCollection();

  // sessionID到贡献点Map
  protected readonly sessionId2contrib = new Map<string, ExtensionDebugAdapterContribution>();
  protected delegated: DebugServer;

  @Autowired(WSChanneHandler)
  protected readonly connectionProvider: WSChanneHandler;

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(DebugServerPath)
  debugServer: DebugServer;

  @Autowired(ILoggerManagerClient)
  private LoggerManager: ILoggerManagerClient;
  private logger: ILogServiceClient = this.LoggerManager.getLogger(SupportLogNamespace.ExtensionHost);

  constructor() {
    this.init();
  }

  protected init(): void {
    this.toDispose.pushAll([
      Disposable.create(() => this.debugServer.dispose()),
      Disposable.create(() => {
        for (const sessionId of this.sessionId2contrib.keys()) {
          const contrib = this.sessionId2contrib.get(sessionId)!;
          contrib.terminateDebugSession(sessionId);
        }
        this.sessionId2contrib.clear();
      })]);
  }

  registerDebugAdapterContribution(contrib: ExtensionDebugAdapterContribution): IDisposable {
    const { type } = contrib;

    if (this.contributors.has(type)) {
      console.warn(`Debugger with type '${type}' already registered.`);
      return Disposable.NULL;
    }

    this.contributors.set(type, contrib);
    return Disposable.create(() => this.unregisterDebugAdapterContribution(type));
  }

  unregisterDebugAdapterContribution(debugType: string): void {
    this.contributors.delete(debugType);
  }

  async debugTypes(): Promise<string[]> {
    const debugTypes = await this.debugServer.debugTypes();
    return debugTypes.concat(Array.from(this.contributors.keys()));
  }

  async provideDebugConfigurations(debugType: string, workspaceFolderUri: string | undefined): Promise<DebugConfiguration[]> {
    const contributor = this.contributors.get(debugType);
    if (contributor) {
      return contributor.provideDebugConfigurations && contributor.provideDebugConfigurations(workspaceFolderUri) || [];
    } else {
      return this.debugServer.provideDebugConfigurations(debugType, workspaceFolderUri);
    }
  }

  async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration> {
    let resolved = config;
    // 处理请求类型为 `*` 的情况
    for (const contributor of this.contributors.values()) {
      if (contributor) {
        try {
          const next = await contributor.resolveDebugConfiguration(resolved, workspaceFolderUri);
          if (next) {
            resolved = next;
          } else {
            return resolved;
          }
        } catch (e) {
          this.logger.error(e);
        }
      }
    }

    return this.debugServer.resolveDebugConfiguration(resolved, workspaceFolderUri);
  }

  async getDebuggersForLanguage(language: string): Promise<DebuggerDescription[]> {
    const debuggers = await this.debugServer.getDebuggersForLanguage(language);

    for (const contributor of this.contributors.values()) {
      const languages = await contributor.languages;
      if (languages && languages.indexOf(language) !== -1) {
        const { type } = contributor;
        debuggers.push({ type, label: await contributor.label || type });
      }
    }

    return debuggers;
  }

  async getSchemaAttributes(debugType: string): Promise<IJSONSchema[]> {
    const contributor = this.contributors.get(debugType);
    if (contributor) {
      return contributor.getSchemaAttributes && contributor.getSchemaAttributes() || [];
    } else {
      return this.debugServer.getSchemaAttributes(debugType);
    }
  }

  async getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    let snippets = await this.debugServer.getConfigurationSnippets();

    for (const contributor of this.contributors.values()) {
      if (contributor.getConfigurationSnippets) {
        snippets = snippets.concat(await contributor.getConfigurationSnippets());
      }
    }

    return snippets;
  }

  async createDebugSession(config: DebugConfiguration): Promise<string> {
    const contributor = this.contributors.get(config.type);
    if (contributor) {
      const sessionId = await contributor.createDebugSession(config);
      this.sessionId2contrib.set(sessionId, contributor);
      return sessionId;
    } else {
      return this.debugServer.createDebugSession(config);
    }
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    const contributor = this.sessionId2contrib.get(sessionId);
    if (contributor) {
      this.sessionId2contrib.delete(sessionId);
      return contributor.terminateDebugSession(sessionId);
    } else {
      return this.debugServer.terminateDebugSession(sessionId);
    }
  }

  dispose(): void {
    this.toDispose.dispose();
  }
}
