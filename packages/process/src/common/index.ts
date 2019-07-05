export interface ProcessOptions<T = string> {
  readonly command: string;
  args?: T[];
  options?: {
    [key: string]: any;
  };
}

export interface ForkOptions {
  readonly modulePath: string;
  args?: string[];
  options?: object;
}

export interface IProcessExitEvent {
  // Exactly one of code and signal will be set.
  readonly code?: number;
  readonly signal?: string;
}

/**
 * Data emitted when a process has been successfully started.
 */
// tslint:disable-next-line: no-empty-interface
export interface IProcessStartEvent {}

/**
 * Data emitted when a process has failed to start.
 */
export interface ProcessErrorEvent extends Error {
  /** An errno-like error string (e.g. ENOENT).  */
  code: string;
}
