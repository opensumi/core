import { ChildProcess, spawn, fork } from 'child_process';
import stream from 'stream';

import { Injectable, Autowired } from '@opensumi/di';
import { Disposable, Emitter } from '@opensumi/ide-core-common';

import {
  ProcessOptions,
  ForkOptions,
  IProcessStartEvent,
  IProcessExitEvent,
  ProcessErrorEvent,
  IProcessManage,
  IProcess,
} from '../common/index';

import { DevNullStream } from './dev-null-stream';
import { ProcessManage } from './process-manager';

@Injectable()
export class ProcessFactory {
  constructor() {}

  @Autowired(IProcessManage)
  private readonly processManage: ProcessManage;

  create(options: ProcessOptions | ForkOptions): IProcess {
    return new Process(options, this.processManage);
  }
}

export class Process extends Disposable implements IProcess {
  readonly process: ChildProcess | undefined;
  readonly outputStream: stream.Readable;
  readonly errorStream: stream.Readable;
  readonly inputStream: stream.Writable;
  protected _killed = false;

  protected readonly startEmitter: Emitter<IProcessStartEvent> = new Emitter<IProcessStartEvent>();
  protected readonly exitEmitter: Emitter<IProcessExitEvent> = new Emitter<IProcessExitEvent>();
  protected readonly errorEmitter: Emitter<ProcessErrorEvent> = new Emitter<ProcessErrorEvent>();

  constructor(options: ProcessOptions | ForkOptions, readonly processManage: ProcessManage) {
    super();
    // About catching errors: spawn will sometimes throw directly
    // (EACCES on Linux), sometimes return a Process object with the pid
    // property undefined (ENOENT on Linux) and then emit an 'error' event.
    // For now, we try to normalize that into always emitting an 'error'
    // event.
    try {
      if (this.isForkOptions(options)) {
        this.process = fork(options.modulePath, options.args, options.options);
      } else {
        this.process = spawn(options.command, options.args, options.options);
      }

      this.process.on('error', (error: NodeJS.ErrnoException) => {
        error.code = error.code || 'Unknown error';
        this.errorEmitter.fire(error as ProcessErrorEvent);
      });
      this.process.on('exit', (exitCode: number, signal: string) => {
        // node's child_process exit sets the unused parameter to null,
        // but we want it to be undefined instead.
        this.emitOnExit({
          code: exitCode !== null ? exitCode : undefined,
          signal: signal !== null ? signal : undefined,
        });
      });

      this.outputStream = this.process.stdout || new DevNullStream();
      this.inputStream = this.process.stdin || new DevNullStream();
      this.errorStream = this.process.stderr || new DevNullStream();

      if (this.process.pid !== undefined) {
        this.processManage.register(this);
        process.nextTick(this.emitOnStart.bind(this));
      }
    } catch (error) {
      /* When an error is thrown, set up some fake streams, so the client
         code doesn't break because these field are undefined.  */
      this.outputStream = new DevNullStream();
      this.inputStream = new DevNullStream();
      this.errorStream = new DevNullStream();

      /* Call the client error handler, but first give them a chance to register it.  */
      process.nextTick(this.emitOnError.bind(this), error);
    }
  }

  protected isForkOptions(options: any): options is ForkOptions {
    return !!options && !!options.modulePath;
  }

  protected emitOnStart() {
    this.startEmitter.fire({});
  }

  protected emitOnError(err: ProcessErrorEvent) {
    this._killed = true;
    this.errorEmitter.fire(err);
  }

  protected emitOnExit(event: IProcessExitEvent) {
    this._killed = true;
    this.exitEmitter.fire(event);
  }

  get pid(): number | null {
    return this.process ? this.process.pid : null;
  }

  get onStart() {
    return this.startEmitter.event;
  }

  get onExit() {
    return this.exitEmitter.event;
  }

  get onError() {
    return this.errorEmitter.event;
  }

  get killed() {
    return this._killed;
  }

  dispose(signal?: string) {
    if (this.process && this.killed === false) {
      // TODO test window is work
      this.process.kill(signal);
    }
  }
}
