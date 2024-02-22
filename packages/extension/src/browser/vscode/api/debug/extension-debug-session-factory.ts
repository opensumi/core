import { Injector } from '@opensumi/di';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { localize } from '@opensumi/ide-core-common';
import { DebugSessionOptions, IDebugModelManager, IDebugSessionManager } from '@opensumi/ide-debug';
import { BreakpointManager } from '@opensumi/ide-debug/lib/browser/breakpoint';
import { DebugPreferences } from '@opensumi/ide-debug/lib/browser/debug-preferences';
import { DebugSession } from '@opensumi/ide-debug/lib/browser/debug-session';
import { DebugSessionConnection } from '@opensumi/ide-debug/lib/browser/debug-session-connection';
import { DebugSessionFactory } from '@opensumi/ide-debug/lib/browser/debug-session-contribution';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { OutputChannel } from '@opensumi/ide-output/lib/browser/output.channel';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService, TerminalOptions } from '@opensumi/ide-terminal-next';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { ExtensionConnection } from '../../../../common/vscode';
import { ThemeIcon } from '../../../../common/vscode/ext-types';

export class ExtensionDebugSession extends DebugSession {
  constructor(
    readonly id: string,
    readonly options: DebugSessionOptions,
    protected readonly connection: DebugSessionConnection,
    protected readonly terminalService: ITerminalApiService,
    protected readonly editorService: WorkbenchEditorService,
    protected readonly breakpointManager: BreakpointManager,
    protected readonly modelManager: IDebugModelManager,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly sessionManager: IDebugSessionManager,
    protected readonly terminalOptionsExt: any,
  ) {
    super(
      id,
      options,
      connection,
      terminalService,
      editorService,
      breakpointManager,
      modelManager,
      labelService,
      messageService,
      fileSystem,
      sessionManager,
    );
  }

  protected async doRunInTerminal(
    terminalOptions: TerminalOptions,
  ): Promise<DebugProtocol.RunInTerminalResponse['body']> {
    if (!terminalOptions.name) {
      terminalOptions.name = localize('debug.terminal.title', 'Debug Process');
    }
    if (!terminalOptions.iconPath) {
      terminalOptions.iconPath = new ThemeIcon('debug');
    }
    const terminalWidgetOptions = {
      ...terminalOptions,
      ...this.terminalOptionsExt,
    };

    return super.doRunInTerminal(terminalWidgetOptions);
  }
}

export class ExtensionDebugSessionFactory implements DebugSessionFactory {
  constructor(
    protected readonly editorManager: WorkbenchEditorService,
    protected readonly breakpoints: BreakpointManager,
    protected readonly modelManager: IDebugModelManager,
    protected readonly terminalService: ITerminalApiService,
    protected readonly labelService: LabelService,
    protected readonly messageService: IMessageService,
    protected readonly debugPreferences: DebugPreferences,
    protected readonly connectionFactory: (sessionId: string) => Promise<ExtensionConnection>,
    protected readonly fileSystem: IFileServiceClient,
    protected readonly terminalOptionsExt: any,
    protected readonly debugPreference: DebugPreferences,
    protected readonly outputService: OutputService,
    protected readonly injector: Injector,
    protected readonly sessionManager: IDebugSessionManager,
  ) {}

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
