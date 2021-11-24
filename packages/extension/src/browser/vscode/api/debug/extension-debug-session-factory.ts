import { Injector } from '@ide-framework/common-di';
import { DebugSession, DebugSessionConnection, BreakpointManager, DebugSessionFactory, DebugPreferences, DebugModelManager } from '@ide-framework/ide-debug/lib/browser';
import { IDebugSessionManager } from '@ide-framework/ide-debug';
import { LabelService } from '@ide-framework/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ide-framework/ide-file-service';
import { WorkbenchEditorService } from '@ide-framework/ide-editor';
import { IMessageService } from '@ide-framework/ide-overlay';
import { IWebSocket } from '@ide-framework/ide-connection';
import { DebugSessionOptions } from '@ide-framework/ide-debug';
import { ITerminalApiService, TerminalOptions } from '@ide-framework/ide-terminal-next';
import { DebugProtocol } from '@ide-framework/vscode-debugprotocol';
import { OutputChannel } from '@ide-framework/ide-output/lib/browser/output.channel';
import { OutputService } from '@ide-framework/ide-output/lib/browser/output.service';

export class ExtensionDebugSession extends DebugSession {
  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly terminalService: ITerminalApiService,
    protected readonly editorService: WorkbenchEditorService,
    protected readonly breakpointManager: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly sessionManager: IDebugSessionManager,
    protected readonly terminalOptionsExt: any,
  ) {
    super(id, options, connection, terminalService, editorService, breakpointManager, modelManager, labelService, messageService, fileSystem, sessionManager);
  }

  protected async doRunInTerminal(terminalOptions: TerminalOptions, command?: string): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    const terminalWidgetOptions = Object.assign({}, terminalOptions, this.terminalOptionsExt);
    return super.doRunInTerminal(terminalWidgetOptions, command);
  }
}

export class ExtensionDebugSessionFactory implements DebugSessionFactory {
  constructor(
    protected readonly editorManager: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly terminalService: ITerminalApiService,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly debugPreferences: DebugPreferences,
    protected readonly connectionFactory: (sessionId: string) => Promise<IWebSocket>,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly terminalOptionsExt: any,
    protected readonly debugPreference: DebugPreferences,
    protected readonly outputService: OutputService,
    protected readonly injector: Injector,
    protected readonly sessionManager: IDebugSessionManager,
  ) {
  }

  get(sessionId: string, options: DebugSessionOptions): DebugSession {
    const connection = this.injector.get(DebugSessionConnection, [
      sessionId,
      this.connectionFactory,
      this.getTraceOutputChannel(),
    ]);

    return new ExtensionDebugSession(
      sessionId,
      options,
      connection,
      this.terminalService,
      this.editorManager,
      this.breakpoints,
      this.modelManager,
      this.labelService,
      this.messageService,
      this.fileSystem,
      this.sessionManager,
      this.terminalOptionsExt,
    );
  }

  protected getTraceOutputChannel(): OutputChannel | undefined {
    if (this.debugPreferences['debug.trace']) {
      return this.outputService.getChannel('Debug adapters');
    }
  }
}
