import { ChildProcess } from 'child_process';
import stream from 'stream';

import { Event } from '@opensumi/ide-core-common';

export const IProcessFactory = Symbol('IProcessFactory');
export const IProcessManage = Symbol('IProcessManage');
export const processManageServicePath = 'ProcessManageService';

export interface IProcess {
  readonly process: ChildProcess | undefined;
  readonly outputStream: stream.Readable;
  readonly errorStream: stream.Readable;
  readonly inputStream: stream.Writable;
  readonly processManage: IProcessManage;
  pid: number | null;
  onStart: Event<unknown>;
  onExit: Event<IProcessExitEvent>;
  onError: Event<ProcessErrorEvent>;
  killed: boolean;
  dispose(signal?: string);
}

export interface IProcessFactory {
  create(options: ProcessOptions | ForkOptions): IProcess;
}

export interface IProcessManage {
  register(process: IProcess): boolean;
  unregister(process: IProcess): void;
  get(id: number): IProcess | undefined;
  onUnregister: Event<number>;
  dispose(): void;
}

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
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IProcessStartEvent {}

/**
 * Data emitted when a process has failed to start.
 */
export interface ProcessErrorEvent extends Error {
  /** An errno-like error string (e.g. ENOENT).  */
  code: string;
}
