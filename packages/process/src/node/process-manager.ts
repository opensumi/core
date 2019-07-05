import { Injectable } from '@ali/common-di';
import { Disposable, getLogger, Emitter, Event } from '@ali/ide-core-common';
import { Process } from './process';

const logger = getLogger();

export const processManageServicePath = 'ProcessManageService';
export const IProcessManage = Symbol('IProcessManage');

export interface IProcessManage {
  register(process: Process): boolean;
  unregister(process: Process): void;
  get(id: number): Process | undefined;
  onUnregister: Event<number>;
  dispose(): void;
}

@Injectable()
export class ProcessManage extends Disposable implements IProcessManage {

  protected readonly processes: Map<number, Process>;
  protected readonly unregisterEmitter: Emitter<number>;

  constructor() {
    super();
    this.processes = new Map();
    this.unregisterEmitter = new Emitter<number>();
  }

  register(process: Process) {
    const id = process.pid;

    if (!id) {
      logger.error('The Process launch failed!');
      return false;
    }
    this.processes.set(id, process);
    process.onExit(() => this.unregister(process));
    process.onError(() => this.unregister(process));
    return true;
  }

  unregister(process: Process) {
    const id = process.pid;
    if (!process.killed) {
      process.dispose();
    }
    if (id && this.processes.delete(id)) {
      this.unregisterEmitter.fire(id);
      // logger.log(`The process was successfully unregistered. ${id}`);
    } else {
      logger.warn(`This process was not registered or was already unregistered. ${id || ''}`);
    }
  }

  get(id: number): Process | undefined {
    return this.processes.get(id);
  }

  get onUnregister(): Event<number> {
    return this.unregisterEmitter.event;
  }

  dispose() {
    this.processes.forEach((process, id) => {
      try {
        this.unregister(process);
      } catch (e) {
        logger.error(`Error occurred when unregistering process. ${id}`, e);
      }
    });
  }
}
