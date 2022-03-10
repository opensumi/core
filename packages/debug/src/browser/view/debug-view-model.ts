/** ******************************************************************************
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/
// Some code copied and modified from https://github.com/eclipse-theia/theia/tree/v1.14.0/packages/debug/src/browser/view/debug-view-model.ts

import { Injectable, Autowired } from '@opensumi/di';
import { URI, IDisposable, DisposableCollection, Event, Emitter } from '@opensumi/ide-core-browser';

import { DebugState, IDebugSessionManager } from '../../common/debug-session';
import { DebugSession } from '../debug-session';
import { DebugSessionManager } from '../debug-session-manager';
import { DebugStackFrame } from '../model/debug-stack-frame';
import { DebugThread } from '../model/debug-thread';


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

  protected readonly toDispose = new DisposableCollection(this.onDidChangeEmitter, this.onDidChangeBreakpointsEmitter);

  protected readonly _sessions = new Set<DebugSession>();

  get sessions(): IterableIterator<DebugSession> {
    return this._sessions.values();
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
    return this.sessions.next().value;
  }

  get id(): string {
    return (this.session && this.session.id) || '-1';
  }
  get label(): string {
    return (this.session && this.session.label) || 'Unknown Session';
  }
  has(session: DebugSession | undefined): session is DebugSession {
    return !!session && this._sessions.has(session);
  }

  init(seesion: DebugSession): void {
    if (seesion) {
      this.push(seesion);
    }
    this.toDispose.push(
      this.manager.onDidChangeActiveDebugSession(({ previous, current }) => {
        if (this.has(previous) && !this.has(current)) {
          this.fireDidChange();
        }
      }),
    );
    this.toDispose.push(
      this.manager.onDidChange((current) => {
        if (this.has(current)) {
          this.fireDidChange();
        }
      }),
    );
    this.toDispose.push(
      this.manager.onDidDestroyDebugSession((current) => {
        if (this.has(current)) {
          this.fireDidChange();
        }
      }),
    );
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  get threads(): IterableIterator<DebugThread> | undefined {
    if (this.manager.currentSession) {
      return this.manager.currentSession.getThreads(() => true);
    }
  }
  get currentSession(): DebugSession | undefined {
    const { currentSession } = this.manager;
    return (this.has(currentSession) && currentSession) || this.session;
  }
  set currentSession(currentSession: DebugSession | undefined) {
    this.manager.updateCurrentSession(currentSession);
  }

  get state(): DebugState {
    const { currentSession } = this;
    return (currentSession && currentSession.state) || DebugState.Inactive;
  }
  get currentThread(): DebugThread | undefined {
    const { currentSession } = this;
    return currentSession && currentSession.currentThread;
  }
  get currentFrame(): DebugStackFrame | undefined {
    const { currentThread } = this;
    return currentThread && currentThread.currentFrame;
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
    const { currentSession } = this;
    if (!currentSession) {
      return;
    }

    const newSession = await this.manager.restart(currentSession);
    if (newSession !== currentSession) {
      this._sessions.delete(currentSession);
      this._sessions.add(newSession);
    }
    this.fireDidChange();
  }

  report(name: string, msg: string | undefined, extra?: any) {
    return this.manager.report(name, msg, extra);
  }

  reportTime(name: string, defaults?: any) {
    return this.manager.reportTime(name, defaults);
  }

  reportAction(sessionId: string, threadId: number | string | undefined, action: string) {
    return this.manager.reportAction(sessionId, threadId, action);
  }
}
