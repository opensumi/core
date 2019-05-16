/********************************************************************************
 * Copyright (C) 2017 TypeFox and others.
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
import { Event, Emitter } from './event';

export interface IDisposable {
  /**
   * Dispose this object.
   */
  dispose(): void;
}

export class Disposable implements IDisposable {
  protected readonly disposables: IDisposable[] = [];
  protected readonly onDisposeEmitter = new Emitter<void>();

  constructor(...toDispose: IDisposable[]) {
    toDispose.forEach(d => this.addDispose(d));
  }

  static create(func: () => void): IDisposable {
    return {
      dispose: func,
    };
  }

  static NULL = Disposable.create(() => {});

  get onDispose(): Event<void> {
    return this.onDisposeEmitter.event;
  }

  protected checkDisposed(): void {
    if (this.disposed && !this.disposingElements) {
      this.onDisposeEmitter.fire(undefined);
    }
  }

  get disposed(): boolean {
    return this.disposables.length === 0;
  }

  private disposingElements = false;
  dispose(): void {
    if (this.disposed || this.disposingElements) {
      return;
    }
    this.disposingElements = true;
    while (!this.disposed) {
      try {
        this.disposables.pop()!.dispose();
      } catch (e) {
        console.error(e);
      }
    }
    this.disposingElements = false;
    this.checkDisposed();
  }

  addDispose(disposable: IDisposable): IDisposable
  addDispose(disposable: IDisposable[]): IDisposable[]
  addDispose(disposable: IDisposable | IDisposable[]): IDisposable | IDisposable[] {
    if (Array.isArray(disposable)) {
      const disposables = disposable;
      return disposables.map(disposable => this.addDispose(disposable));
    } else {
      const disposables = this.disposables;
      disposables.push(disposable);
      const originalDispose = disposable.dispose.bind(disposable);
      const toRemove = Disposable.create(() => {
        const index = disposables.indexOf(disposable);
        if (index !== -1) {
          disposables.splice(index, 1);
        }
        this.checkDisposed();
      });
      disposable.dispose = () => {
        toRemove.dispose();
        originalDispose();
      };
      return toRemove;
    }
  }
}
