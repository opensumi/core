import { DebugProtocol } from 'vscode-debugprotocol/lib/debugProtocol';
import { DebugSession } from '../debug-session';
import { DebugThread } from './debug-thread';
import { DebugSource } from './debug-source';

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

  async open() {
    console.log('Do debug stack frame view open');
  }

  protected toArgs<T extends object>(arg?: T): { frameId: number } & T {
    return Object.assign({}, arg, {
      frameId: this.raw.id,
    });
  }
}
