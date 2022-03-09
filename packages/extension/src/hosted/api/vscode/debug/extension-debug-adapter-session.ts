import type vscode from 'vscode';

import { IWebSocket } from '@opensumi/ide-connection';
import { DebugStreamConnection, DebugConfiguration } from '@opensumi/ide-debug';

import { StreamDebugAdapter } from './abstract-debug-adapter-session';

export class ExtensionDebugAdapterSession extends StreamDebugAdapter implements vscode.DebugSession {
  readonly type: string;
  readonly name: string;
  readonly workspaceFolder: vscode.WorkspaceFolder | undefined;
  readonly configuration: DebugConfiguration;

  constructor(
    protected readonly communicationProvider: DebugStreamConnection,
    protected readonly tracker: vscode.DebugAdapterTracker,
    protected readonly debugSession: vscode.DebugSession,
  ) {
    super(debugSession.id, communicationProvider);

    this.type = debugSession.type;
    this.name = debugSession.name;
    this.workspaceFolder = debugSession.workspaceFolder;
    this.configuration = debugSession.configuration;
  }

  public get parentSession(): vscode.DebugSession | undefined {
    return this.debugSession.parentSession;
  }

  async start(channel: IWebSocket): Promise<void> {
    if (this.tracker.onWillStartSession) {
      this.tracker.onWillStartSession();
    }
    await super.start(channel);
  }

  async stop(): Promise<void> {
    if (this.tracker.onWillStopSession) {
      this.tracker.onWillStopSession();
    }
    await super.stop();
  }

  async customRequest(command: string, args?: any): Promise<any> {
    return this.debugSession.customRequest(command, args);
  }

  async getDebugProtocolBreakpoint(breakpoint: vscode.Breakpoint): Promise<vscode.DebugProtocolBreakpoint | undefined> {
    return this.debugSession.getDebugProtocolBreakpoint(breakpoint);
  }

  protected onDebugAdapterError(error: Error): void {
    if (this.tracker.onError) {
      this.tracker.onError(error);
    }
    super.onDebugAdapterError(error);
  }

  protected send(message: string): void {
    try {
      super.send(message);
    } finally {
      if (this.tracker.onDidSendMessage) {
        this.tracker.onDidSendMessage(message);
      }
    }
  }

  protected write(message: string): void {
    if (this.tracker.onWillReceiveMessage) {
      this.tracker.onWillReceiveMessage(message);
    }
    super.write(message);
  }

  protected onDebugAdapterExit(exitCode: number, signal: string | undefined): void {
    if (this.tracker.onExit) {
      this.tracker.onExit(exitCode, signal);
    }
    super.onDebugAdapterExit(exitCode, signal);
  }
}
