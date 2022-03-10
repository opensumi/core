import { Injectable, Autowired } from '@opensumi/di';
import {
  Disposable,
  IDisposable,
  DisposableCollection,
  IJSONSchema,
  IJSONSchemaSnippet,
  WaitUntilEvent,
} from '@opensumi/ide-core-browser';
import { DebugServer, DebuggerDescription, IDebugSessionManager, IDebugSessionDTO } from '@opensumi/ide-debug';
import { DebugConfigurationManager } from '@opensumi/ide-debug/lib/browser';
import { DebugConfiguration } from '@opensumi/ide-debug/lib/common/debug-configuration';
import { ILoggerManagerClient, SupportLogNamespace, ILogServiceClient } from '@opensumi/ide-logs/lib/browser';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { DebugActivationEvent } from '../../../../common/vscode';
import { IActivationEventService } from '../../../types';

import { ExtensionDebugAdapterContribution } from './extension-debug-adapter-contribution';

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

  @Autowired(IWorkspaceService)
  protected readonly workspaceService: IWorkspaceService;

  @Autowired(ILoggerManagerClient)
  protected readonly loggerManager: ILoggerManagerClient;
  protected logger: ILogServiceClient;

  @Autowired(IDebugSessionManager)
  protected readonly debugSessionManager: IDebugSessionManager;

  @Autowired(DebugConfigurationManager)
  protected readonly debugConfigurationManager: DebugConfigurationManager;

  @Autowired(IActivationEventService)
  protected readonly activationEventService: IActivationEventService;

  protected readonly activationEvents = new Set<string>();

  constructor() {
    this.init();
  }

  protected init(): void {
    this.logger = this.loggerManager.getLogger(SupportLogNamespace.ExtensionHost);
    this.debugSessionManager.onWillStartDebugSession((event) => this.ensureDebugActivation(event));
    this.debugSessionManager.onWillResolveDebugConfiguration((event) =>
      this.ensureDebugActivation(event, 'onDebugResolve', event.debugType),
    );
    this.debugConfigurationManager.onWillProvideDebugConfiguration((event) =>
      this.ensureDebugActivation(event, 'onDebugInitialConfigurations'),
    );
    this.toDispose.pushAll([
      Disposable.create(() => {
        for (const sessionId of this.sessionId2contrib.keys()) {
          const contrib = this.sessionId2contrib.get(sessionId)!;
          contrib.terminateDebugSession(sessionId);
        }
        this.sessionId2contrib.clear();
      }),
    ]);
  }

  registerDebugAdapterContribution(contrib: ExtensionDebugAdapterContribution): IDisposable {
    const { type } = contrib;

    if (this.contributors.has(type)) {
      this.logger.warn(`Debugger with type '${type}' already registered.`);
      return Disposable.NULL;
    }

    this.contributors.set(type, contrib);
    return Disposable.create(() => this.unregisterDebugAdapterContribution(type));
  }

  unregisterDebugAdapterContribution(debugType: string): void {
    this.contributors.delete(debugType);
  }

  protected ensureDebugActivation(
    event: WaitUntilEvent,
    activationEvent?: DebugActivationEvent,
    debugType?: string,
  ): void {
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(this.activateByDebug(activationEvent, debugType));
    }
  }

  async activateByDebug(activationEvent?: DebugActivationEvent, debugType?: string): Promise<void> {
    const promises = [this.activationEventService.fireEvent('onDebug')];
    if (activationEvent) {
      promises.push(this.activationEventService.fireEvent(activationEvent));
      if (debugType) {
        promises.push(this.activationEventService.fireEvent(activationEvent, debugType));
      }
    }
    await Promise.all(promises);
  }

  async debugTypes(): Promise<string[]> {
    return Array.from(this.contributors.keys());
  }

  async provideDebugConfigurations(
    debugType: string,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration[]> {
    const contributor = this.contributors.get(debugType);
    if (contributor) {
      return (
        (contributor.provideDebugConfigurations && contributor.provideDebugConfigurations(workspaceFolderUri)) || []
      );
    } else {
      return [];
    }
  }

  async resolveDebugConfiguration(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null> {
    const contributor = this.contributors.get(config.type);
    if (contributor) {
      try {
        const next = await contributor.resolveDebugConfiguration(config, workspaceFolderUri);
        return next;
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  async resolveDebugConfigurationWithSubstitutedVariables(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null> {
    const contributor = this.contributors.get(config.type);
    if (contributor) {
      try {
        const next = await contributor.resolveDebugConfigurationWithSubstitutedVariables(config, workspaceFolderUri);
        return next;
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  async getDebuggersForLanguage(language: string): Promise<DebuggerDescription[]> {
    const debuggers: DebuggerDescription[] = [];

    for (const contributor of this.contributors.values()) {
      const languages = await contributor.languages;
      if (languages && languages.indexOf(language) !== -1) {
        const { type } = contributor;
        debuggers.push({ type, label: (await contributor.label) || type });
      }
    }

    return debuggers;
  }

  async getSchemaAttributes(debugType: string): Promise<IJSONSchema[]> {
    const contributor = this.contributors.get(debugType);
    if (contributor) {
      return (contributor.getSchemaAttributes && contributor.getSchemaAttributes()) || [];
    } else {
      return [];
    }
  }

  async getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    let snippets: IJSONSchemaSnippet[] = [];

    for (const contributor of this.contributors.values()) {
      if (contributor.getConfigurationSnippets) {
        snippets = snippets.concat(await contributor.getConfigurationSnippets());
      }
    }

    return snippets;
  }

  async createDebugSession(dto: IDebugSessionDTO): Promise<string | void> {
    const { configuration } = dto;
    const contributor = this.contributors.get(configuration.type);
    if (contributor) {
      const sessionId = await contributor.createDebugSession(dto);
      this.sessionId2contrib.set(sessionId, contributor);
      return sessionId;
    }
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    const contributor = this.sessionId2contrib.get(sessionId);
    if (contributor) {
      this.sessionId2contrib.delete(sessionId);
      return contributor.terminateDebugSession(sessionId);
    }
  }

  dispose(): void {
    this.toDispose.dispose();
  }
}
