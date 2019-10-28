import { DebugSession, DebugSessionConnection, BreakpointManager, DebugSessionFactory, DebugPreferences, DebugModelManager } from '@ali/ide-debug/lib/browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ali/ide-file-service';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMessageService } from '@ali/ide-overlay';
import { IWebSocket } from '@ali/ide-connection';
import { DebugSessionOptions } from '@ali/ide-debug';
import { ITerminalClient, TerminalOptions } from '@ali/ide-terminal2';
import { DebugProtocol } from 'vscode-debugprotocol';
import { OutputChannel } from '@ali/ide-output/lib/browser/output.channel';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';

export class ExtensionDebugSession extends DebugSession {
  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly terminalService: ITerminalClient,
    protected readonly editorService: WorkbenchEditorService,
    protected readonly breakpointManager: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly terminalOptionsExt: any,
  ) {
    super(id, options, connection, terminalService, editorService, breakpointManager, modelManager, labelService, messageService, fileSystem);
  }

  protected async doRunInTerminal(terminalOptions: TerminalOptions): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    const terminalWidgetOptions = Object.assign({}, terminalOptions, this.terminalOptionsExt);
    return super.doRunInTerminal(terminalWidgetOptions);
  }
}

export class ExtensionDebugSessionFactory implements DebugSessionFactory {
  constructor(
    protected readonly editorManager: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly modelManager: DebugModelManager,
    protected readonly terminalService: ITerminalClient,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly debugPreferences: DebugPreferences,
    protected readonly connectionFactory: (sessionId: string) => Promise<IWebSocket>,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly terminalOptionsExt: any,
    protected readonly debugPreference: DebugPreferences,
    protected readonly outputService: OutputService,
  ) {
  }

  get(sessionId: string, options: DebugSessionOptions): DebugSession {
    const connection = new DebugSessionConnection(sessionId, this.connectionFactory, this.getTraceOutputChannel());

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
      this.terminalOptionsExt);
  }

  protected getTraceOutputChannel(): OutputChannel | undefined {
    if (this.debugPreferences['debug.trace']) {
      return this.outputService.getChannel('Debug adapters');
    }
  }
}
