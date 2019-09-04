import { Injectable, Autowired } from '@ali/common-di';
import { ContributionProvider } from '@ali/ide-core-browser';
import { DebugSessionOptions } from './debug-session-options';
import { DebugSession } from './debug-session';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { WSChanneHandler } from '@ali/ide-connection';
import { DebugPreferences } from './debug-preferences';
import { DebugSessionConnection } from './debug-session-connection';
import { DebugAdapterPath } from '../common';
import { ITerminalService, ITerminalServicePath } from '@ali/ide-terminal2/lib/common';
import { BreakpointManager } from './breakpoint';
import { IMessageService } from '@ali/ide-overlay';
import { WorkbenchEditorService } from '@ali/ide-editor';

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

    @Autowired(WSChanneHandler)
    protected readonly connectionProvider: WSChanneHandler;
    // TODO use browser
    @Autowired(ITerminalServicePath)
    protected readonly terminalService: ITerminalService;
    @Autowired(WorkbenchEditorService)
    protected readonly workbenchEditorService: WorkbenchEditorService;
    @Autowired(BreakpointManager)
    protected readonly breakpoints: BreakpointManager;
    @Autowired(LabelService)
    protected readonly labelService: LabelService;
    @Autowired(IMessageService)
    protected readonly messages: IMessageService;
    // @Autowired(OutputChannelManager)
    // protected readonly outputChannelManager: OutputChannelManager;
    @Autowired(DebugPreferences)
    protected readonly debugPreferences: DebugPreferences;
    @Autowired(FileServiceClient)
    protected readonly fileSystem: FileServiceClient;

    get(sessionId: string, options: DebugSessionOptions): DebugSession {
        const connection = new DebugSessionConnection(
          sessionId,
          (sessionId: string) => {
            return this.connectionProvider.openChannel(`${DebugAdapterPath}/${sessionId}`);
          },
        );
        return new DebugSession(
            sessionId,
            options,
            connection,
            this.terminalService,
            this.workbenchEditorService,
            this.breakpoints,
            this.labelService,
            this.messages,
            this.fileSystem);
    }

    // protected getTraceOutputChannel(): OutputChannel | undefined {
    //     if (this.debugPreferences['debug.trace']) {
    //         // return this.outputChannelManager.getChannel('Debug adapters');
    //     }
    // }
}
