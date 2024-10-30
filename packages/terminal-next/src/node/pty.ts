/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.63.0/src/vs/platform/terminal/node/terminalProcess.ts

import { promises } from 'fs';
import os from 'os';

import omit from 'lodash/omit';
import * as pty from 'node-pty';
import * as osLocale from 'os-locale';

import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, Emitter, INodeLogger, URI, isWindows, path } from '@opensumi/ide-core-node';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';

import { IShellLaunchConfig, ITerminalLaunchError } from '../common';
import { IProcessExitEvent, IProcessReadyEvent } from '../common/process';
import { IPtyProcessProxy, IPtyService, IPtySpawnOptions } from '../common/pty';

import { IPtyServiceManager, PtyServiceManagerToken } from './pty.manager';
import { findExecutable } from './shell';
import { IShellIntegrationService } from './shell-integration.service';

export { IPtyService };

@Injectable({ multiple: true })
export class PtyService extends Disposable implements IPtyService {
  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  @Autowired(PtyServiceManagerToken)
  protected readonly ptyServiceManager: IPtyServiceManager;

  @Autowired(IShellIntegrationService)
  protected readonly shellIntegrationService: IShellIntegrationService;

  protected readonly _ptyOptions: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions;
  private _ptyProcess: IPtyProcessProxy | undefined;

  private readonly _onData = new Emitter<string>();
  readonly onData = this._onData.event;

  private readonly _onReady = new Emitter<IProcessReadyEvent>();
  readonly onReady = this._onReady.event;

  private readonly _onExit = new Emitter<IProcessExitEvent>();
  readonly onExit = this._onExit.event;
  // private readonly ptyServiceManager = new PtyServiceManager();
  // 终端的sessionId，也就是构造函数传入的id
  private readonly sessionId: string;

  private readonly _onProcessChange = new Emitter<string>();
  readonly onProcessChange = this._onProcessChange.event;

  private previouslyProcess: string | undefined;

  get pty() {
    return this._ptyProcess;
  }

  constructor(public id: string, public readonly shellLaunchConfig: IShellLaunchConfig, cols: number, rows: number) {
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
    this.sessionId = id;
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

    const locale = await osLocale.default();
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

    // HACK: 这里的处理逻辑有些黑，后续需要整体去整理下 Shell Integration，然后整体优化一下
    // 如果是启动 bash，则使用 init file 植入 Integration 能力
    if (options.executable?.includes('bash')) {
      const bashIntegrationPath = await this.shellIntegrationService.initBashInitFile();
      if (!options.args) {
        options.args = [];
      }
      if (Array.isArray(options.args)) {
        // bash 的参数中，如果有 --init-file 则不再添加
        if (!options.args.includes('--init-file')) {
          // --init-file 要放在最前面，bash 的启动参数必须要 long options 在前面，否则会启动失败
          options.args.unshift('--init-file', bashIntegrationPath);
        }
      }
    }

    // ZSH 相关的能力注入
    if (options.executable?.includes('zsh')) {
      const zshDotFilesPath = await this.shellIntegrationService.initZshDotFiles();

      if (!ptyEnv) {
        ptyEnv = {};
      }

      ptyEnv['USER_ZDOTDIR'] = ptyEnv['ZDOTDIR'] || os.homedir() || '~';
      ptyEnv['ZDOTDIR'] = zshDotFilesPath;
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

  protected async setupPtyProcess() {
    const options = this.shellLaunchConfig;
    const ptySpawnOptions: IPtySpawnOptions = {
      preserveHistory: !options?.disablePreserveHistory,
    };
    const args = options.args || [];
    const ptyProcess = await this.ptyServiceManager.spawn(
      options.executable as string,
      args,
      this._ptyOptions,
      this.sessionId,
      ptySpawnOptions,
    );

    this.addDispose(
      ptyProcess.onData(async (e) => {
        this._onData.fire(e);
        const processName = await ptyProcess.getProcessDynamically();
        if (processName !== this.previouslyProcess) {
          this.previouslyProcess = processName;
          this._onProcessChange.fire(processName);
        }
      }),
    );

    this.addDispose(
      ptyProcess.onExit((e) => {
        this._onExit.fire(e);
        this.dispose();
      }),
    );

    ptyProcess.bin = options.executable as string;
    ptyProcess.launchConfig = options;
    ptyProcess.parsedName = path.basename(options.executable as string);

    this._sendProcessId(ptyProcess.pid);

    this._ptyProcess = ptyProcess;
  }
  private _sendProcessId(pid: number) {
    this._onReady.fire({
      pid,
    });
  }

  protected parseCwd() {
    if (this.shellLaunchConfig.cwd) {
      return typeof this.shellLaunchConfig.cwd === 'string'
        ? this.shellLaunchConfig.cwd
        : URI.from(this.shellLaunchConfig.cwd).path.toString();
    }
    return os.homedir();
  }

  getShellName() {
    return this._ptyProcess?.parsedName || 'not started';
  }

  getPid() {
    return this._ptyProcess?.pid || -1;
  }

  async getCwd() {
    if (!this._ptyProcess) {
      return undefined;
    }
    return this._ptyProcess.getCwd();
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
