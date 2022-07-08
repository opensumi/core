import { Injectable } from '@opensumi/di';
import { DisposableCollection, Emitter, Event } from '@opensumi/ide-core-common';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol';

import { DebugConfiguration, DebugSessionOptions, DebugState, IDebugSession } from '../src/common';

@Injectable({ multiple: true })
export class MockDebugSession implements IDebugSession {
  private _on: Emitter<any> = new Emitter();
  private _onDidChange: Emitter<any> = new Emitter();
  private _onDidCustomEvent: Emitter<any> = new Emitter();
  private _onCurrentThreadChange: Emitter<any> = new Emitter();
  private _onDidInvalidateMemory: Emitter<any> = new Emitter();

  private disposable = new DisposableCollection();
  private _id: string;

  constructor(sessionId?: string, options?: Partial<DebugSessionOptions>) {
    if (options) {
      this._configuration = options.configuration || this._configuration;
    }
    if (sessionId) {
      this._id = sessionId;
    }
    this.disposable.push(this._on);
    this.disposable.push(this._onDidChange);
    this.disposable.push(this._onDidCustomEvent);
    this.disposable.push(this._onCurrentThreadChange);
    this.disposable.push(this._onDidInvalidateMemory);
  }
  capabilities: DebugProtocol.Capabilities;
  onDidInvalidateMemory: Event<DebugProtocol.MemoryEvent>;
  readMemory(memoryReference: string, offset: number, count: number): Promise<DebugProtocol.ReadMemoryResponse | undefined> {
    throw new Error('Method not implemented.');
  }
  writeMemory(memoryReference: string, offset: number, data: string, allowPartial?: boolean): Promise<DebugProtocol.WriteMemoryResponse | undefined> {
    throw new Error('Method not implemented.');
  }
  capabilities: DebugProtocol.Capabilities;
  onDidInvalidateMemory: Event<DebugProtocol.MemoryEvent>;
  readMemory(memoryReference: string, offset: number, count: number): Promise<DebugProtocol.ReadMemoryResponse | undefined> {
    throw new Error('Method not implemented.');
  }
  writeMemory(memoryReference: string, offset: number, data: string, allowPartial?: boolean): Promise<DebugProtocol.WriteMemoryResponse | undefined> {
    throw new Error('Method not implemented.');
  }

  private _configuration: DebugConfiguration = {
    name: 'mock',
    type: 'mock',
    request: 'launch',
  };

  get on() {
    return this._on.event as any;
  }

  get onDidInvalidateMemory() {
    return this._onDidInvalidateMemory.event;
  }

  get onDidChange() {
    return this._onDidChange.event;
  }

  get onDidCustomEvent() {
    return this._onDidCustomEvent.event;
  }

  get onCurrentThreadChange() {
    return this._onCurrentThreadChange.event;
  }

  get configuration() {
    return this._configuration;
  }

  get capabilities() {
    return {};
  }

  get state() {
    return DebugState.Running;
  }

  get parentSession() {
    return undefined;
  }

  get id() {
    return this._id;
  }

  get compact() {
    return false;
  }

  hasSeparateRepl() {
    return true;
  }

  getDebugProtocolBreakpoint() {
    return undefined;
  }

  async sendRequest() {
    return {} as any;
  }

  async start() {
    // do nothing
  }

  async restart() {
    return true;
  }

  async disconnect() {
    // do nothing
  }

  async terminate() {
    // do nothing
  }

  async readMemory(memoryReference: string, offset: number, count: number) {
    return undefined;
  }

  async writeMemory(memoryReference: string, offset: number, data: string, allowPartial?: boolean) {
    return undefined;
  }

  dispose() {
    this.disposable.dispose();
  }
}
