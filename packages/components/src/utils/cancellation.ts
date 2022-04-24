// Modify from @opensumi/ide-core-common/src/cancellation.ts

import { IDisposable } from './disposable';
import { Emitter, Event } from './event';

export interface CancellationToken {
  readonly isCancellationRequested: boolean;
  /**
   * An event emitted when cancellation is requested
   * @event
   */
  readonly onCancellationRequested: Event<any>;
}

const shortcutEvent = Object.freeze(function (callback, context?): IDisposable {
  const handle = setTimeout(callback.bind(context), 0);
  return {
    dispose() {
      clearTimeout(handle);
    },
  };
} as Event<any>);

export namespace CancellationToken {
  export function isCancellationToken(thing: any): thing is CancellationToken {
    if (thing === CancellationToken.None || thing === CancellationToken.Cancelled) {
      return true;
    }
    if (thing instanceof MutableToken) {
      return true;
    }
    if (!thing || typeof thing !== 'object') {
      return false;
    }
    return (
      typeof (thing as CancellationToken).isCancellationRequested === 'boolean' &&
      typeof (thing as CancellationToken).onCancellationRequested === 'function'
    );
  }

  export const None: CancellationToken = Object.freeze({
    isCancellationRequested: false,
    onCancellationRequested: Event.None,
  });

  export const Cancelled: CancellationToken = Object.freeze({
    isCancellationRequested: true,
    onCancellationRequested: shortcutEvent,
  });
}

class MutableToken implements CancellationToken {
  private _isCancelled = false;
  private _emitter: Emitter<any> | null = null;

  public cancel() {
    if (!this._isCancelled) {
      this._isCancelled = true;
      if (this._emitter) {
        this._emitter.fire(undefined);
        this.dispose();
      }
    }
  }

  get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  get onCancellationRequested(): Event<any> {
    if (this._isCancelled) {
      return shortcutEvent;
    }
    if (!this._emitter) {
      this._emitter = new Emitter<any>();
    }
    return this._emitter.event;
  }

  public dispose(): void {
    if (this._emitter) {
      this._emitter.dispose();
      this._emitter = null;
    }
  }
}

export class CancellationTokenSource {
  private _token?: CancellationToken = undefined;
  private _parentListener?: IDisposable = undefined;

  constructor(parent?: CancellationToken) {
    this._parentListener = parent && parent.onCancellationRequested(this.cancel, this);
  }

  get token(): CancellationToken {
    if (!this._token) {
      // be lazy and create the token only when
      // actually needed
      this._token = new MutableToken();
    }
    return this._token;
  }

  cancel(): void {
    if (!this._token) {
      // save an object by returning the default
      // cancelled token when cancellation happens
      // before someone asks for the token
      this._token = CancellationToken.Cancelled;
    } else if (this._token instanceof MutableToken) {
      // actually cancel
      this._token.cancel();
    }
  }

  dispose(cancel = false): void {
    if (cancel) {
      this.cancel();
    }
    if (this._parentListener) {
      this._parentListener.dispose();
    }
    if (!this._token) {
      // ensure to initialize with an empty token if we had none
      this._token = CancellationToken.None;
    } else if (this._token instanceof MutableToken) {
      // actually dispose
      this._token.dispose();
    }
  }
}
