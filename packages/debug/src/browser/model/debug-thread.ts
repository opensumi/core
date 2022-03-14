import { Event, Emitter } from '@opensumi/ide-core-browser';
import { DebugProtocol } from '@opensumi/vscode-debugprotocol/lib/debugProtocol';

import { DEBUG_REPORT_NAME } from '../../common';
import { DebugSession } from '../debug-session';

import { DebugStackFrame } from './debug-stack-frame';


export type StoppedDetails = DebugProtocol.StoppedEvent['body'] & {
  framesErrorMessage?: string;
  totalFrames?: number;
};

export class DebugThreadData {
  readonly raw: DebugProtocol.Thread;
  readonly stoppedDetails: StoppedDetails | undefined;
}

export class DebugThread extends DebugThreadData {
  protected readonly _onDidChanged = new Emitter<void>();
  readonly onDidChanged: Event<void> = this._onDidChanged.event;

  constructor(readonly session: DebugSession) {
    super();
  }

  get id(): string {
    return this.session.id + ':' + this.raw.id;
  }

  protected _currentFrame: DebugStackFrame | undefined;
  get currentFrame(): DebugStackFrame | undefined {
    return this._currentFrame;
  }
  set currentFrame(frame: DebugStackFrame | undefined) {
    this._currentFrame = frame;
    this._onDidChanged.fire();
  }

  get stopped(): boolean {
    return !!this.stoppedDetails;
  }

  update(data: Partial<DebugThreadData>): void {
    Object.assign(this, data);
    if ('stoppedDetails' in data) {
      this.clearFrames();
    }
  }

  clear(): void {
    this.update({
      raw: this.raw,
      stoppedDetails: undefined,
    });
  }

  continue(): Promise<DebugProtocol.ContinueResponse> {
    return this.session.sendRequest('continue', this.toArgs());
  }

  stepOver(): Promise<DebugProtocol.NextResponse> {
    return this.session.sendRequest('next', this.toArgs());
  }

  stepIn(): Promise<DebugProtocol.StepInResponse> {
    return this.session.sendRequest('stepIn', this.toArgs());
  }

  stepOut(): Promise<DebugProtocol.StepOutResponse> {
    return this.session.sendRequest('stepOut', this.toArgs());
  }

  pause(): Promise<DebugProtocol.PauseResponse> {
    return this.session.sendRequest('pause', this.toArgs());
  }

  terminate(): Promise<DebugProtocol.TerminateResponse> {
    return this.session.sendRequest('terminateThreads', { threadIds: [this.raw.id] });
  }

  protected readonly _frames = new Map<number, DebugStackFrame>();
  get frames(): DebugStackFrame[] {
    return Array.from(this._frames.values());
  }
  get topFrame(): DebugStackFrame | undefined {
    return this.frames[0];
  }
  get frameCount(): number {
    return this._frames.size;
  }

  protected pendingFetch = Promise.resolve<DebugStackFrame[]>([]);
  async rawFetchFrames(levels = 20): Promise<DebugStackFrame[]> {
    return (this.pendingFetch = this.pendingFetch.then(async () => {
      try {
        const start = this.frameCount;
        const frames = await this.doFetchFrames(start, levels);
        const newframes = this.doUpdateFrames(frames);
        return newframes;
      } catch (e) {
        return [];
      }
    }));
  }

  async fetchFrames(levels = 20): Promise<DebugStackFrame[]> {
    const frames = await this.rawFetchFrames(levels);
    this.updateCurrentFrame();
    return frames;
  }

  protected async doFetchFrames(startFrame: number, levels: number): Promise<DebugProtocol.StackFrame[]> {
    try {
      const response = await this.session.sendRequest(
        'stackTrace',
        this.toArgs<Partial<DebugProtocol.StackTraceArguments>>({ startFrame, levels }),
      );
      if (this.stoppedDetails) {
        this.stoppedDetails.totalFrames = response.body.totalFrames;
      }
      return response.body.stackFrames;
    } catch (e) {
      if (this.stoppedDetails) {
        this.stoppedDetails.framesErrorMessage = e.message;
      }
      return [];
    }
  }
  protected doUpdateFrames(frames: DebugProtocol.StackFrame[]): DebugStackFrame[] {
    const frontEndTime = this.session.reportTime(DEBUG_REPORT_NAME.DEBUG_UI_FRONTEND_TIME, {
      sessionId: this.session.id,
      threadId: this.raw.id,
      threadAmount: this.session.threadCount,
    });
    const result = new Map<number, DebugStackFrame>(this._frames);
    for (const raw of frames) {
      const id = raw.id;
      const frame = this._frames.get(id) || new DebugStackFrame(this, this.session);
      this._frames.set(id, frame);
      frame.update({ raw });
      result.set(id, frame);
    }
    const values = [...result.values()];
    frontEndTime('doUpdateFrames');
    return values;
  }
  protected clearFrames(): void {
    this._frames.clear();
    this.updateCurrentFrame();
  }
  protected updateCurrentFrame(): void {
    const { currentFrame } = this;
    const frameId = currentFrame && currentFrame.raw.id;
    this.currentFrame =
      (typeof frameId === 'number' && this._frames.get(frameId)) || this._frames.values().next().value;
  }

  protected toArgs<T extends object>(arg?: T): { threadId: number } & T {
    return Object.assign({}, arg, {
      threadId: this.raw.id,
    });
  }
}
