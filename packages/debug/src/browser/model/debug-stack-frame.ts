import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { DebugThread } from './debug-thread';
import { DebugSource } from './debug-source';
import { IResourceOpenOptions } from '@ali/ide-editor';
import { IRange } from '@ali/ide-core-node';

export class DebugStackFrameData {
  readonly raw: DebugProtocol.StackFrame;
}

export class DebugStackFrame extends DebugStackFrameData {
  constructor(
    readonly thread: DebugThread,
    readonly session: DebugSession,
  ) {
    super();
  }

  get id(): string {
    return this.session.id + ':' + this.thread.id + ':' + this.raw.id;
  }

  protected _source: DebugSource | undefined;
  get source(): DebugSource | undefined {
    return this._source;
  }
  update(data: Partial<DebugStackFrameData>): void {
    Object.assign(this, data);
    this._source = this.raw.source && this.session.getSource(this.raw.source);
  }

  async restart(): Promise<void> {
    await this.session.sendRequest('restartFrame', this.toArgs({
      threadId: this.thread.id,
    }));
  }

  async open(options?: IResourceOpenOptions) {
    if (!this.source) {
      return;
    }
    const { line, column, endLine, endColumn } = this.raw;
    let range: IRange = {
      startLineNumber: line,
      startColumn: column,
      endLineNumber: line,
      endColumn: Infinity,
    };
    if (typeof endLine === 'number') {
      range = {
        ...range,
        endLineNumber: endLine,
        endColumn: typeof endColumn === 'number' ? endColumn : Infinity,
      };
    }
    this.source.open({
      ...options,
      range,
    });
  }

  protected toArgs<T extends object>(arg?: T): { frameId: number } & T {
    return Object.assign({}, arg, {
      frameId: this.raw.id,
    });
  }

  protected scopes: Promise<any[]> | undefined;
  getScopes(): Promise<any[]> {
    return this.scopes || (this.scopes = this.doGetScopes());
  }
  protected async doGetScopes(): Promise<any[]> {
    try {
      const response = await this.session.sendRequest('scopes', this.toArgs());
      return response.body.scopes.map((raw) => raw);
    } catch (e) {
      return [];
    }
  }
}
