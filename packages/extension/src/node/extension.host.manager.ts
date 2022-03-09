import assert from 'assert';
import cp from 'child_process';

import isRunning from 'is-running';
import treeKill from 'tree-kill';

import { Injectable } from '@opensumi/di';
import { MaybePromise, Event, findFreePort } from '@opensumi/ide-core-common';

import { IExtensionHostManager, Output, OutputType } from '../common';

@Injectable()
export class ExtensionHostManager implements IExtensionHostManager {
  private readonly processMap = new Map<number, cp.ChildProcess>();

  constructor() {
    this.init();
  }

  init() {
    // 这个 debug 插件 https://github.com/microsoft/vscode/blob/1.44.2/extensions/debug-auto-launch/src/extension.ts#L120
    // 依赖了 vscode pid 来查找子进程
    process.env['VSCODE_PID'] = String(process.pid);
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
      extProcess!.send(message, (err) => {
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
  kill(pid: number, signal?: NodeJS.Signals) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess!.kill(signal);
  }
  isKilled(pid: number) {
    const extProcess = this.processMap.get(pid);
    if (!extProcess) {
      return true;
    }
    return extProcess.killed;
  }

  findDebugPort(startPort: number, giveUpAfter: number, timeout: number) {
    return findFreePort(startPort, giveUpAfter, timeout);
  }

  onOutput(pid: number, listener: (output: Output) => void) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess!.stdout!.setEncoding('utf8');
    extProcess!.stderr!.setEncoding('utf8');
    const onStdout = Event.fromNodeEventEmitter<string>(extProcess!.stdout!, 'data');
    const onStderr = Event.fromNodeEventEmitter<string>(extProcess!.stderr!, 'data');
    const onOutput = Event.any(
      Event.map(onStdout, (o) => ({ type: OutputType.STDOUT, data: `%c${o}`, format: [''] })),
      Event.map(onStderr, (o) => ({ type: OutputType.STDERR, data: `%c${o}`, format: ['color: red'] })),
    );

    // Debounce all output, so we can render it in the Chrome console as a group
    const onDebouncedOutput = Event.debounce<Output>(
      onOutput,
      (r, o) =>
        r
          ? {
              data: r.data + o.data,
              format: [...r.format, ...o.format],
              type: [r.type, o.type].includes(OutputType.STDERR) ? OutputType.STDERR : OutputType.STDOUT,
            }
          : { data: o.data, format: o.format, type: o.type },
      100,
    );

    onDebouncedOutput(listener);
  }

  onExit(pid: number, listener: (code: number, signal: string) => void) {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess!.once('exit', listener);
  }

  onMessage(pid: number, listener: (msg: any) => void): MaybePromise<void> {
    const extProcess = this.processMap.get(pid);
    assert(extProcess);
    extProcess!.on('message', listener);
  }

  disposeProcess(pid: number) {
    const extProcess = this.processMap.get(pid);
    if (extProcess) {
      if (this.isRunning(pid)) {
        extProcess.kill();
      }
      this.processMap.delete(pid);
    }
  }

  async dispose(): Promise<void> {
    await Promise.all(
      [...this.processMap.keys()].map(async (pid) => {
        const isRunning = await this.isRunning(pid);
        if (isRunning) {
          await this.treeKill(pid);
        }
      }),
    );
    this.processMap.clear();
  }
}
