import { Injectable } from '@ali/common-di';
import { MaybePromise, Event, findFreePort } from '@ali/ide-core-common';
import { IExtensionHostManager, Output } from '../common';
import * as assert from 'assert';
import * as cp from 'child_process';
import * as isRunning from 'is-running';
import treeKill = require('tree-kill');

@Injectable()
export class ExtensionHostManager implements IExtensionHostManager {

  private readonly processMap = new Map<number, cp.ChildProcess>();

  init() {
    // noop
  }
  fork(modulePath: string, ...args: any[]) {
    const extProcess = cp.fork(modulePath, ...args);
    this.processMap.set(extProcess.pid, extProcess);
    return extProcess.pid;
  }
  send(pid: number, message: string) {
    return new Promise<void>((resolve, reject) => {
      const extProcess = this.processMap.get(pid);
      assert(extProcess);
      extProcess.send(message, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  isRunning(pid: number) {
    return isRunning(pid);
  }
  treeKill(pid: number) {
    return new Promise<void>((resolve, reject) => {
      treeKill(pid, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  kill(pid: number, signal?: string) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess.kill(signal);
  }
  isKilled(pid: number) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    return extProcess.killed;
  }

  findDebugPort(startPort: number, giveUpAfter: number, timeout: number) {
    return findFreePort(startPort, giveUpAfter, timeout);
  }

  /**
   * 这里的作用是在**非开发模式下**(isDevelopment() === false), 通过 process._debugProcess 启动调试时监听 stdout 的输出获取调试端口
   * @example
   * ```ts
   * process._debugProcess(<extHostProcess.pid>);
   *
   * // stdout:
   * // Debugger listening on ws://127.0.0.1:<port>/f3f6f226-7dbc-4009-95fa-d516ba132fbd
   * // For help see https://nodejs.org/en/docs/inspector
   * ```
   */
  onInspect(pid: number, listener: (output: Output) => void) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess.stdout.setEncoding('utf8');
    extProcess.stderr.setEncoding('utf8');
    const onStdout = Event.fromNodeEventEmitter<string>(extProcess.stdout, 'data');
    const onStderr = Event.fromNodeEventEmitter<string>(extProcess.stderr, 'data');
    const onOutput = Event.any(
      Event.map(onStdout, (o) => ({ data: `%c${o}`, format: [''] })),
      Event.map(onStderr, (o) => ({ data: `%c${o}`, format: ['color: red'] })),
    );

    // Debounce all output, so we can render it in the Chrome console as a group
    const onDebouncedOutput = Event.debounce<Output>(onOutput, (r, o) => {
      return r
        ? { data: r.data + o.data, format: [...r.format, ...o.format] }
        : { data: o.data, format: o.format };
    }, 100);

    onDebouncedOutput(listener);
  }

  onExit(pid: number, listener: (code: number, signal: string) => void) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess.on('exit', listener);
  }

  onMessage(pid: number, listener: (msg: any) => void): MaybePromise<void> {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess.on('message', listener);
  }

  disposeProcess(pid: number) {
    const extProcess = this.processMap.get(pid);
    if (extProcess) {
      this.processMap.delete(pid);
    }
  }
}
