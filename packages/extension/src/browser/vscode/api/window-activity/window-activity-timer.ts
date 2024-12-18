import { Disposable, Emitter, Event } from '@opensumi/ide-core-browser';

const MAX_INACTIVITY_COUNT = 30;
const INACTIVITY_CHECK_INTERVAL = 1000;

export class WindowActivityTimer extends Disposable {
  private activityCount = 0;
  private readonly maxInactivityCount: number = MAX_INACTIVITY_COUNT;
  private readonly inactivityCheckInterval: number = INACTIVITY_CHECK_INTERVAL;
  private inactivityCheckTimer: ReturnType<typeof setTimeout> | undefined;
  private isActive = true;

  // Event emitter for active state changes
  private readonly activeStateChangedEmitter = new Emitter<boolean>();

  // Window instance where the timer is active
  constructor(private readonly window: Window, inactivityLimit: number = 30, checkInterval: number = 1000) {
    super();
    this.maxInactivityCount = inactivityLimit;
    this.inactivityCheckInterval = checkInterval;

    // Set up event listeners for user activity
    this.setupActivityListeners();
  }

  // Getter for event listener
  get onDidChangeActiveState(): Event<boolean> {
    return this.activeStateChangedEmitter.event;
  }

  // Set the current activity state
  private setActiveState(newState: boolean): void {
    if (this.isActive !== newState) {
      this.isActive = newState;
      this.activeStateChangedEmitter.fire(newState);
    }
  }

  // Set up event listeners for detecting user activity
  private setupActivityListeners(): void {
    this.window.addEventListener('mousedown', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
    this.window.addEventListener('keydown', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
    this.window.addEventListener('touchstart', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
  }

  // Reset the inactivity timer when activity is detected
  private resetInactivityTimer = (): void => {
    this.activityCount = 0;
    this.setActiveState(true);
    if (!this.inactivityCheckTimer) {
      this.startInactivityCheck();
    }
  };

  // Check if the user is inactive and update the state
  private checkInactivity = (): void => {
    this.activityCount++;

    if (this.activityCount >= this.maxInactivityCount) {
      this.setActiveState(false);
      this.stopInactivityCheck();
    }
  };

  // Start the inactivity timer
  private startInactivityCheck(): void {
    this.stopInactivityCheck();
    this.inactivityCheckTimer = setInterval(() => {
      this.checkInactivity();
    }, this.inactivityCheckInterval);
  }

  // Stop the inactivity timer
  private stopInactivityCheck(): void {
    if (this.inactivityCheckTimer) {
      clearInterval(this.inactivityCheckTimer);
      this.inactivityCheckTimer = undefined;
    }
  }

  // Clean up event listeners and stop the timer when disposed
  dispose(): void {
    this.stopInactivityCheck();
    this.activeStateChangedEmitter.dispose();
    super.dispose();
    this.window.removeEventListener('mousedown', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
    this.window.removeEventListener('keydown', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
    this.window.removeEventListener('touchstart', this.resetInactivityTimer, {
      passive: true,
      capture: true,
    } as AddEventListenerOptions);
  }
}
