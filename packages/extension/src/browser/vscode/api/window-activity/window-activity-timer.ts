import { Disposable, Emitter, Event } from '@opensumi/ide-core-browser';

const CHECK_INACTIVITY_LIMIT = 30;
const CHECK_INACTIVITY_INTERVAL = 1000;

const eventListenerOptions: AddEventListenerOptions = {
  passive: true,
  capture: true,
};
export class WindowActivityTimer extends Disposable {
  private activityCounter = 0; // number of times inactivity was checked since last reset
  private readonly limitedTime = CHECK_INACTIVITY_LIMIT; // number of inactivity checks done before sending inactive signal
  private readonly checkInactivityInterval = CHECK_INACTIVITY_INTERVAL; // check interval in milliseconds
  private timer: NodeJS.Timeout | undefined;
  protected readonly onDidChangeActiveStateEmitter = new Emitter<boolean>();
  private _activeState: boolean = true;
  private keepRunning: boolean = true;

  constructor(readonly win: Window) {
    super();
    this.setupListeners(this.win);
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

  private setupListeners(win: Window): void {
    win.addEventListener('mousedown', this.resetActivity, eventListenerOptions);
    win.addEventListener('keydown', this.resetActivity, eventListenerOptions);
    win.addEventListener('touchstart', this.resetActivity, eventListenerOptions);
  }

  // Reset inactivity time
  private resetActivity = (): void => {
    this.keepRunning = true;
    this.activityCounter = 0;
    if (!this.timer) {
      // it was not active. Set as active and restart tracking inactivity
      this.activeState = true;
      this.startTimer();
    }
  };

  // Check inactivity status
  private checkInactivity = (): void => {
    this.activityCounter++;
    if (this.activityCounter >= this.limitedTime) {
      this.activeState = false;
      this.stopTimer();
    }
  };

  public repeatTask(task, delay): void {
    if (!this.keepRunning) {
      this.timer = undefined;
      return;
    }
    task();

    this.timer = setTimeout(() => {
      this.repeatTask(task, delay);
    }, delay);
  }

  // start timer
  public startTimer(): void {
    this.stopTimer();
    this.repeatTask(this.checkInactivity, this.checkInactivityInterval);
  }

  // stop timer
  public stopTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
      this.keepRunning = false;
    }
  }

  dispose(): void {
    this.stopTimer();
    this.win.removeEventListener('mousedown', this.resetActivity, eventListenerOptions);
    this.win.removeEventListener('keydown', this.resetActivity, eventListenerOptions);
    this.win.removeEventListener('touchstart', this.resetActivity, eventListenerOptions);
  }
}
