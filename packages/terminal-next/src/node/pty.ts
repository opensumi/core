/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.63.0/src/vs/platform/terminal/node/terminalProcess.ts

import { promises } from 'fs';
import os from 'os';

import omit from 'lodash.omit';
import * as pty from 'node-pty';
import * as osLocale from 'os-locale';

import { Injectable, Autowired } from '@opensumi/di';
import * as path from '@opensumi/ide-core-common/lib/path';
import { isWindows } from '@opensumi/ide-core-common/lib/platform';
import { Disposable, Emitter, INodeLogger } from '@opensumi/ide-core-node';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';

import { IShellLaunchConfig, ITerminalLaunchError } from '../common';
import { IProcessReadyEvent, IProcessExitEvent } from '../common/process';
import { IPtyProcess } from '../common/pty';

import { findExecutable } from './shell';


export const IPtyService = Symbol('IPtyService');

@Injectable({ multiple: true })
export class PtyService extends Disposable {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  private readonly _ptyOptions: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions;
  private _ptyProcess: IPtyProcess | undefined;

  private readonly _onData = new Emitter<string>();
  readonly onData = this._onData.event;
  private readonly _onReady = new Emitter<IProcessReadyEvent>();
  readonly onReady = this._onReady.event;
  private readonly _onExit = new Emitter<IProcessExitEvent>();
  readonly onExit = this._onExit.event;

  get pty() {
    return this._ptyProcess;
  }

  constructor(public id: string, private readonly shellLaunchConfig: IShellLaunchConfig, cols: number, rows: number) {
    super();
    let name: string;
    if (isWindows) {
      name = path.basename(this.shellLaunchConfig.executable || '');
    } else {
      // Using 'xterm-256color' here helps ensure that the majority of Linux distributions will use a
      // color prompt as defined in the default ~/.bashrc file.
      name = 'xterm-256color';
    }

    const cwd = this.parseCwd();
    this._ptyOptions = {
      name,
      cwd,
      env: shellLaunchConfig.env as { [key: string]: string },
      cols,
      rows,
    };
  }

  async kill(): Promise<void> {
    if (this.disposed) {
      return;
    }

    try {
      if (this._ptyProcess) {
        this._ptyProcess.kill();
      }
    } catch (ex) {}
  }

  async _validateCwd(): Promise<ITerminalLaunchError | undefined> {
    const { cwd } = this._ptyOptions;
    if (cwd) {
      try {
        const result = await promises.stat(cwd);
        if (!result.isDirectory()) {
          return {
            message: `Starting directory (cwd) "${cwd}" is not a directory`,
          };
        }
      } catch (err) {
        if (err?.code === 'ENOENT') {
          return {
            message: `Starting directory (cwd) "${cwd}" does not exist`,
          };
        }
      }
    } else {
      return {
        message: 'IPtyForkOptions.cwd not set',
      };
    }
  }
  async _validateExecutable(): Promise<ITerminalLaunchError | undefined> {
    const options = this.shellLaunchConfig;
    const { cwd } = this._ptyOptions;
    if (!options.executable) {
      return {
        message: 'IShellLaunchConfig.executable not set',
      };
    }
    try {
      const result = await promises.stat(options.executable);
      if (!result.isFile() && !result.isSymbolicLink()) {
        return {
          message: `Path to shell executable "${options.executable}" is not a file or a symlink`,
        };
      }
    } catch (err) {
      if (err?.code === 'ENOENT') {
        // The executable isn't an absolute path, try find it on the PATH or CWD
        const envPaths: string[] | undefined =
          options.env && options.env.PATH ? options.env.PATH.split(path.delimiter) : undefined;
        const executable = await findExecutable(options.executable, cwd, envPaths);
        if (!executable) {
          return {
            message: `Path to shell executable "${options.executable}" does not exist`,
          };
        }
        // Set the executable explicitly here so that node-pty doesn't need to search the
        // $PATH too.
        options.executable = executable;
      }
    }
  }

  async start(): Promise<ITerminalLaunchError | undefined> {
    const options = this.shellLaunchConfig;

    const locale = osLocale.sync();
    let ptyEnv: { [key: string]: string };

    if (options.strictEnv) {
      ptyEnv = options.env as { [key: string]: string };
    } else {
      ptyEnv = Object.assign(
        {},
        omit(process.env, [
          'KTELECTRON',
          'EXTENSION_HOST_ENTRY',
          'EXTENSION_DIR',
          'WORKSPACE_DIR',
          'CODE_WINDOW_CLIENT_ID',
          'VSCODE_NLS_CONFIG',
          'ELECTRON_RUN_AS_NODE',
        ]),
        {
          LC_ALL: `${locale.replace('-', '_')}.UTF-8`,
          LANG: `${locale.replace('-', '_')}.UTF-8`,
          /**
           * IMPORTANT:
           * **这里不要使用 shell-path ，因为其依赖的 shell-env 在某些情况下，macOS 及 Linux 上都会出现永远无法返回的问题
           * [shell-env's sync function returns no output](https://github.com/sindresorhus/shell-env/issues/17)
           * 这会导致 IDE 进程的通信直卡住无法返回，表现为假死状态，进程运行正常，但前端任何交互都会一直 loading**
           */
          PATH: await getShellPath(),
        },
        options.env,
      ) as { [key: string]: string };
    }

    this._ptyOptions['env'] = ptyEnv;

    const results = await Promise.all([this._validateCwd(), this._validateExecutable()]);
    const firstError = results.find((r) => r !== undefined);
    if (firstError) {
      return firstError;
    }

    try {
      await this.setupPtyProcess();
      return undefined;
    } catch (err) {
      this.logger.error('IPty#spawn native exception', err);
      return { message: `A native exception occurred during launch (${err.message})` };
    }
  }

  private async setupPtyProcess() {
    const options = this.shellLaunchConfig;

    const args = options.args || [];
    const ptyProcess = pty.spawn(options.executable as string, args, this._ptyOptions);

    this.addDispose(
      ptyProcess.onData((e) => {
        this._onData.fire(e);
      }),
    );

    this.addDispose(
      ptyProcess.onExit((e) => {
        this._onExit.fire(e);
        this.dispose();
      }),
    );

    (ptyProcess as IPtyProcess).bin = options.executable as string;
    (ptyProcess as IPtyProcess).launchConfig = options;
    (ptyProcess as IPtyProcess).parsedName = path.basename(options.executable as string);

    this._sendProcessId(ptyProcess.pid);

    this._ptyProcess = ptyProcess as IPtyProcess;
  }
  private _sendProcessId(pid: number) {
    this._onReady.fire({
      pid,
    });
  }

  parseCwd() {
    if (this.shellLaunchConfig.cwd) {
      return typeof this.shellLaunchConfig.cwd === 'string'
        ? this.shellLaunchConfig.cwd
        : this.shellLaunchConfig.cwd.fsPath;
    }
    return os.homedir();
  }

  getShellName() {
    return this._ptyProcess?.parsedName || 'not started';
  }

  getPid() {
    return this._ptyProcess?.pid || -1;
  }

  resize(rows: number, cols: number) {
    try {
      this._ptyProcess?.resize(cols, rows);
    } catch (e) {
      return false;
    }
    return true;
  }
  onMessage(data: string) {
    this._ptyProcess?.write(data);
  }
}
