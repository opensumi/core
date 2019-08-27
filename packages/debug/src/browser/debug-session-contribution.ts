import { Injectable, Autowired } from '@ali/common-di';
import { ContributionProvider } from '@ali/ide-core-browser';
import { DebugSessionOptions } from './debug-session-options';
import { DebugSession } from './debug-session';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { IFileSearchService } from '@ali/ide-search';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { WSChanneHandler } from '@ali/ide-connection';
import { DebugPreferences } from './debug-preferences';
import { DebugSessionConnection } from './debug-session-connection';

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
    // @Autowired(TerminalService)
    // protected readonly terminalService: TerminalService;
    // @Autowired(EditorManager)
    // protected readonly editorManager: EditorManager;
    // @Autowired(BreakpointManager)
    // protected readonly breakpoints: BreakpointManager;
    @Autowired(LabelService)
    protected readonly labelService: LabelService;
    // @Autowired(MessageClient)
    // protected readonly messages: MessageClient;
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
            // this.getTraceOutputChannel());

        // return new DebugSession(
        //     sessionId,
        //     options,
        //     connection,
        //     this.terminalService,
        //     this.editorManager,
        //     this.breakpoints,
        //     this.labelService,
        //     this.messages,
        //     this.fileSystem);
    }

    // protected getTraceOutputChannel(): OutputChannel | undefined {
    //     if (this.debugPreferences['debug.trace']) {
    //         // return this.outputChannelManager.getChannel('Debug adapters');
    //     }
    // }
}
