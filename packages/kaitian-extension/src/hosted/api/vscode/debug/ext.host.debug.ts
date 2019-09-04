import { Injectable } from '@ali/common-di';
import * as vscode from 'vscode';
import { IExtHostDebug, IExtensionDescription } from '../../../../common/vscode';
import { Emitter, Event } from '@ali/ide-core-common';
import { Disposable } from '../../../../common/vscode/ext-types';

@Injectable()
export class ExtHostDebug implements IExtHostDebug {

  private readonly onDidChangeBreakpointsEmitter = new Emitter<vscode.BreakpointsChangeEvent>();
  private readonly onDidChangeActiveDebugSessionEmitter = new Emitter<vscode.DebugSession | undefined>();
  private readonly onDidTerminateDebugSessionEmitter = new Emitter<vscode.DebugSession>();
  private readonly onDidStartDebugSessionEmitter = new Emitter<vscode.DebugSession>();
  private readonly onDidReceiveDebugSessionCustomEmitter = new Emitter<vscode.DebugSessionCustomEvent>();

  // debug API
  get onDidChangeBreakpoints(): Event<vscode.BreakpointsChangeEvent> {
    return this.onDidChangeBreakpointsEmitter.event;
  }

  get onDidReceiveDebugSessionCustomEvent(): Event<vscode.DebugSessionCustomEvent> {
    return this.onDidReceiveDebugSessionCustomEmitter.event;
  }

  get onDidChangeActiveDebugSession(): Event<vscode.DebugSession | undefined> {
      return this.onDidChangeActiveDebugSessionEmitter.event;
  }

  get onDidTerminateDebugSession(): Event<vscode.DebugSession> {
      return this.onDidTerminateDebugSessionEmitter.event;
  }

  get onDidStartDebugSession(): Event<vscode.DebugSession> {
      return this.onDidStartDebugSessionEmitter.event;
  }

  get breakpoints(): vscode.Breakpoint[] {
    // TODO
    return [];
  }

  async addBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void> {
    // TODO
  }

  async removeBreakpoints(breakpoints0: vscode.Breakpoint[]): Promise<void> {
    // TODO
  }

  async startDebugging(folder: vscode.WorkspaceFolder | undefined, nameOrConfig: string | vscode.DebugConfiguration, parentSession?: vscode.DebugSession): Promise<boolean> {
    // TODO
    return false;
  }

  registerDebugConfigurationProvider(type: string, provider: vscode.DebugConfigurationProvider): vscode.Disposable {
    return new Disposable(() => { });
    // TODO
  }

  registerDebugAdapterDescriptorFactory(extension: IExtensionDescription, type: string, factory: vscode.DebugAdapterDescriptorFactory): vscode.Disposable {
    // TODO
    return new Disposable(() => { });
  }

  public registerDebugAdapterTrackerFactory(type: string, factory: vscode.DebugAdapterTrackerFactory): vscode.Disposable {
    // TODO
    return new Disposable(() => { });
  }

  // RPC methods

}
