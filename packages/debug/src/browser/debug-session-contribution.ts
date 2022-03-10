import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { WSChannelHandler } from '@opensumi/ide-connection/lib/browser';
import { ContributionProvider } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { OutputChannel } from '@opensumi/ide-output/lib/browser/output.channel';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService } from '@opensumi/ide-terminal-next/lib/common';

import { DebugAdapterPath, DebugSessionOptions, IDebugSessionManager } from '../common';

import { BreakpointManager } from './breakpoint';
import { DebugPreferences } from './debug-preferences';
import { DebugSession } from './debug-session';
import { DebugSessionConnection } from './debug-session-connection';
import { DebugSessionManager } from './debug-session-manager';
import { DebugModelManager } from './editor/debug-model-manager';


export const DebugSessionContribution = Symbol('DebugSessionContribution');

export interface DebugSessionContribution {
  /**
   * 调试类型，如node2
   */
  debugType: string;

  /**
   * 生成DebugSession的工厂函数.
   */
  debugSessionFactory(): DebugSessionFactory;
}

export const DebugSessionContributionRegistry = Symbol('DebugSessionContributionRegistry');

export interface DebugSessionContributionRegistry {
  get(debugType: string): DebugSessionContribution | undefined;
}

@Injectable()
export class DebugSessionContributionRegistryImpl implements DebugSessionContributionRegistry {
  protected readonly contribs = new Map<string, DebugSessionContribution>();

  @Autowired(DebugSessionContribution)
  protected readonly contributions: ContributionProvider<DebugSessionContribution>;

  constructor() {
    this.init();
  }

  protected init(): void {
    for (const contrib of this.contributions.getContributions()) {
      this.contribs.set(contrib.debugType, contrib);
    }
  }

  get(debugType: string): DebugSessionContribution | undefined {
    return this.contribs.get(debugType);
  }
}

export const DebugSessionFactory = Symbol('DebugSessionFactory');

/**
 * 生成DebugSession的工厂函数.
 */
export interface DebugSessionFactory {
  get(sessionId: string, options: DebugSessionOptions): DebugSession;
}

@Injectable()
export class DefaultDebugSessionFactory implements DebugSessionFactory {
  @Autowired(WSChannelHandler)
  protected readonly connectionProvider: WSChannelHandler;
  @Autowired(WorkbenchEditorService)
  protected readonly workbenchEditorService: WorkbenchEditorService;
  @Autowired(BreakpointManager)
  protected readonly breakpoints: BreakpointManager;
  @Autowired(DebugModelManager)
  protected readonly modelManager: DebugModelManager;
  @Autowired(LabelService)
  protected readonly labelService: LabelService;
  @Autowired(IMessageService)
  protected readonly messages: IMessageService;
  @Autowired(DebugPreferences)
  protected readonly debugPreferences: DebugPreferences;
  @Autowired(IFileServiceClient)
  protected readonly fileSystem: IFileServiceClient;
  @Autowired(ITerminalApiService)
  protected readonly terminalService: ITerminalApiService;
  @Autowired(OutputService)
  protected readonly outputService: OutputService;
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;
  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  get(sessionId: string, options: DebugSessionOptions): DebugSession {
    const connection = this.injector.get(DebugSessionConnection, [
      sessionId,
      (sessionId: string) => this.connectionProvider.openChannel(`${DebugAdapterPath}/${sessionId}`),
      this.getTraceOutputChannel(),
    ]);
    return new DebugSession(
      sessionId,
      options,
      connection,
      this.terminalService,
      this.workbenchEditorService,
      this.breakpoints,
      this.modelManager,
      this.labelService,
      this.messages,
      this.fileSystem,
      this.manager,
    );
  }

  protected getTraceOutputChannel(): OutputChannel | undefined {
    if (this.debugPreferences['debug.trace']) {
      return this.outputService.getChannel('Debug adapters');
    }
  }
}
