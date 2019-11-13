import { DebugSession, DebugState } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugThread } from '../model/debug-thread';
import { DebugStackFrame } from '../model/debug-stack-frame';
import { DebugBreakpoint, ExceptionBreakpoint } from '../model/debug-breakpoint';
import { URI, IDisposable, DisposableCollection, Event, Emitter } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { IDebugSessionManager } from '../../common/debug-session';

@Injectable()
export class DebugViewModel implements IDisposable {

  @Autowired(IDebugSessionManager)
  protected readonly manager: DebugSessionManager;

  protected readonly onDidChangeEmitter = new Emitter<void>();
  readonly onDidChange: Event<void> = this.onDidChangeEmitter.event;
  protected fireDidChange(): void {
    this.onDidChangeEmitter.fire(undefined);
  }

  protected readonly onDidChangeBreakpointsEmitter = new Emitter<URI>();
  readonly onDidChangeBreakpoints: Event<URI> = this.onDidChangeBreakpointsEmitter.event;
  protected fireDidChangeBreakpoints(uri: URI): void {
    this.onDidChangeBreakpointsEmitter.fire(uri);
  }

  protected readonly toDispose = new DisposableCollection(
    this.onDidChangeEmitter,
    this.onDidChangeBreakpointsEmitter,
  );

  protected readonly _sessions = new Set<DebugSession>();

  get sessions(): DebugSession[] {
    return Array.from(this._sessions);
  }

  get sessionCount(): number {
    return this._sessions.size;
  }

  push(session: DebugSession): void {
    if (this._sessions.has(session)) {
      return;
    }
    this._sessions.add(session);
    this.fireDidChange();
  }

  delete(session: DebugSession): boolean {
    if (this._sessions.delete(session)) {
      this.fireDidChange();
      return true;
    }
    return false;
  }

  get session(): DebugSession | undefined {
    return this.sessions[0];
  }

  get id(): string {
    return this.session && this.session.id || '-1';
  }
  get label(): string {
    return this.session && this.session.label || 'Unknown Session';
  }
  has(session: DebugSession | undefined): session is DebugSession {
    return !!session && this._sessions.has(session);
  }

  init(seesion: DebugSession): void {
    if (seesion) {
      this.push(seesion);
    }
    this.toDispose.push(this.manager.onDidChangeActiveDebugSession(({ previous, current }) => {
      if (this.has(previous) && !this.has(current)) {
        this.fireDidChange();
      }
    }));
    this.toDispose.push(this.manager.onDidChange((current) => {
      if (this.has(current)) {
        this.fireDidChange();
      }
    }));
    this.toDispose.push(this.manager.onDidChangeBreakpoints(({ session, uri }) => {
      if (!session || session === this.currentSession) {
        this.fireDidChangeBreakpoints(uri);
      }
    }));
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  get currentSession(): DebugSession | undefined {
    const { currentSession } = this.manager;
    return this.has(currentSession) && currentSession || this.session;
  }
  set currentSession(currentSession: DebugSession | undefined) {
    this.manager.currentSession = currentSession;
  }

  get state(): DebugState {
    const { currentSession } = this;
    return currentSession && currentSession.state || DebugState.Inactive;
  }
  get currentThread(): DebugThread | undefined {
    const { currentSession } = this;
    return currentSession && currentSession.currentThread;
  }
  get currentFrame(): DebugStackFrame | undefined {
    const { currentThread } = this;
    return currentThread && currentThread.currentFrame;
  }

  get breakpoints(): DebugBreakpoint[] {
    return this.manager.getBreakpoints(this.currentSession);
  }

  get exceptionBreakpoints(): ExceptionBreakpoint[] {
    return this.manager.getExceptionBreakpoints(this.currentSession);
  }

  async start(): Promise<void> {
    const { session } = this;
    if (!session) {
      return;
    }
    const newSession = await this.manager.start(session.options);
    if (newSession) {
      this._sessions.delete(session);
      this._sessions.add(newSession);
      this.fireDidChange();
    }
  }

  async restart(): Promise<void> {
    const { session } = this;
    if (!session) {
      return;
    }
    const newSession = await this.manager.restart(session);
    if (newSession !== session) {
      this._sessions.delete(session);
      this._sessions.add(newSession);
    }
    this.fireDidChange();
  }

}
