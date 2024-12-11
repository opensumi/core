import { Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { DisposableCollection } from '@opensumi/ide-core-browser';
import { Emitter, Event } from '@opensumi/ide-core-common';

import { ExtHostAPIIdentifier, IExtHostWindowState } from '../../../common/vscode';
@Injectable({ multiple: true })
export class MainThreadWindowState {
  private readonly proxy: IExtHostWindowState;
  private blurHandler;
  private focusHandler;

  private readonly toDispose = new DisposableCollection();

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWindowState);

    this.blurHandler = () => {
      this.proxy.$onDidChangeWindowFocus(false);
    };
    this.focusHandler = () => {
      this.proxy.$onDidChangeWindowFocus(true);
    };
    window.addEventListener('blur', this.blurHandler);

    window.addEventListener('focus', this.focusHandler);

    const tracker = new WindowActivityTracker(window);
    this.toDispose.push(tracker.onDidChangeActiveState((isActive) => this.onActiveStateChanged(isActive)));
    this.toDispose.push(tracker);
  }

  private onActiveStateChanged(isActive: boolean): void {
    this.proxy.$onDidChangeWindowActive(isActive);
  }

  public dispose() {
    window.removeEventListener('blur', this.blurHandler);
    window.removeEventListener('focus', this.focusHandler);
  }
}

const CHECK_INACTIVITY_LIMIT = 30;
const CHECK_INACTIVITY_INTERVAL = 1000;

const eventListenerOptions: AddEventListenerOptions = {
  passive: true,
  capture: true,
};

class WindowActivityTracker {
  private inactivityCounter = 0; // number of times inactivity was checked since last reset
  private readonly inactivityLimit = CHECK_INACTIVITY_LIMIT; // number of inactivity checks done before sending inactive signal
  private readonly checkInactivityInterval = CHECK_INACTIVITY_INTERVAL; // check interval in milliseconds
  private interval: NodeJS.Timeout | undefined;

  protected readonly onDidChangeActiveStateEmitter = new Emitter<boolean>();
  private _activeState: boolean = true;

  constructor(readonly win: Window) {
    this.initializeListeners(this.win);
  }

  get onDidChangeActiveState(): Event<boolean> {
    return this.onDidChangeActiveStateEmitter.event;
  }

  private set activeState(newState: boolean) {
    if (this._activeState !== newState) {
      this._activeState = newState;
      this.onDidChangeActiveStateEmitter.fire(this._activeState);
    }
  }

  private initializeListeners(win: Window): void {
    // currently assumes activity based on key/mouse/touch pressed, not on mouse move or scrolling.
    win.addEventListener('mousedown', this.resetInactivity, eventListenerOptions);
    win.addEventListener('keydown', this.resetInactivity, eventListenerOptions);
    win.addEventListener('touchstart', this.resetInactivity, eventListenerOptions);
  }

  dispose(): void {
    this.stopTracking();
    this.win.removeEventListener('mousedown', this.resetInactivity);
    this.win.removeEventListener('keydown', this.resetInactivity);
    this.win.removeEventListener('touchstart', this.resetInactivity);
  }

  // Reset inactivity time
  private resetInactivity = (): void => {
    this.inactivityCounter = 0;
    if (!this.interval) {
      // it was not active. Set as active and restart tracking inactivity
      this.activeState = true;
      this.startTracking();
    }
  };

  // Check inactivity status
  private checkInactivity = (): void => {
    this.inactivityCounter++;
    if (this.inactivityCounter >= this.inactivityLimit) {
      this.activeState = false;
      this.stopTracking();
    }
  };

  public startTracking(): void {
    this.stopTracking();
    this.interval = setInterval(this.checkInactivity, this.checkInactivityInterval);
  }

  public stopTracking(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
}
