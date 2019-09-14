import { DebugSession, DebugSessionOptions, DebugSessionConnection, BreakpointManager, DebugSessionFactory, DebugPreferences } from '@ali/ide-debug/lib/browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IFileServiceClient } from '@ali/ide-file-service';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { IMessageService } from '@ali/ide-overlay';
import { IWebSocket } from '@ali/ide-connection';

export class ExtensionDebugSession extends DebugSession {
  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly editorService: WorkbenchEditorService,
    protected readonly breakpointManager: BreakpointManager,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly fileSystem: IFileServiceClient,
  ) {
    super(id, options, connection, editorService, breakpointManager, labelService, messageService, fileSystem);
  }

  // protected async doRunInTerminal(terminalOptions: any): Promise<DebugProtocol.RunInTerminalResponse['body']> {
  //   // terminalWidgetOptions = Object.assign({}, terminalWidgetOptions, this.terminalOptionsExt);
  //   // return super.doRunInTerminal(terminalWidgetOptions);
  // }
}

export class ExtensionDebugSessionFactory implements DebugSessionFactory {
  constructor(
    protected readonly editorManager: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly debugPreferences: DebugPreferences,
    protected readonly connectionFactory: (sessionId: string) => Promise<IWebSocket>,
    protected readonly fileSystem: IFileServiceClient,
  ) {
  }

  get(sessionId: string, options: DebugSessionOptions): DebugSession {
    const connection = new DebugSessionConnection(sessionId, this.connectionFactory);

    return new ExtensionDebugSession(
      sessionId,
      options,
      connection,
      this.editorManager,
      this.breakpoints,
      this.labelService,
      this.messageService,
      this.fileSystem);
  }
}
