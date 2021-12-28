/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.63.0/src/vs/platform/terminal/node/terminalProcess.ts

import * as pty from 'node-pty';
import * as osLocale from 'os-locale';
import omit from 'lodash.omit';
import { IShellLaunchConfig } from '../common';
import { IPty } from '../common/pty';
import { findExecutable } from './shell';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';
import { formatLocalize, INodeLogger } from '@opensumi/ide-core-node';
import { Injectable, Autowired } from '@opensumi/di';
import { promises } from 'fs';
import * as path from '@opensumi/ide-core-common/lib/path';
import { IProcessEnvironment } from '@opensumi/ide-core-common/lib/platform';
export { pty };

export const IPtyService = Symbol('IPtyService');

@Injectable()
export class PtyService {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  async _validateCwd(options: IShellLaunchConfig) {
    if (options.cwd) {
      try {
        const result = await promises.stat(options.cwd);
        if (!result.isDirectory()) {
          return {
            message: formatLocalize('terminal.launchFail.cwdNotDirectory', options.cwd),
          };
        }
      } catch (err) {
        if (err?.code === 'ENOENT') {
          return {
            message: formatLocalize('terminal.launchFail.cwdDoesNotExist', options.cwd),
          };
        }
      }
    }

    return undefined;
  }
  async _validateExecutable(options: IShellLaunchConfig, ptyEnv: IProcessEnvironment) {
    if (!options.shellPath) {
      return {
        message: 'options.shellPath not set',
      };
    }
    try {
      const result = await promises.stat(options.shellPath);
      if (!result.isFile() && !result.isSymbolicLink()) {
        return {
          message: formatLocalize('terminal.launchFail.executableIsNotFileOrSymlink', options.shellPath),
        };
      }
    } catch (err) {
      if (err?.code === 'ENOENT') {
        // The executable isn't an absolute path, try find it on the PATH or CWD
        const envPaths: string[] | undefined =
          options.env && options.env.PATH ? options.env.PATH.split(path.delimiter) : undefined;
        const executable = await findExecutable(options.shellPath, options.cwd, envPaths, ptyEnv);
        if (!executable) {
          return {
            message: formatLocalize('terminal.launchFail.executableDoesNotExist', options.shellPath),
          };
        }
        // Set the shellPath explicitly here so that node-pty doesn't need to search the
        // $PATH too.
        options.shellPath = executable;
      }
    }
  }

  async create2(options: IShellLaunchConfig) {
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

    const results = await Promise.all([this._validateCwd(options), this._validateExecutable(options, ptyEnv)]);
    const firstError = results.find((r) => r !== undefined);
    if (firstError) {
      throw new Error(firstError.message);
    }

    // above code will validate shellPath and throw if it doesn't exist

    const ptyProcess = pty.spawn(options.shellPath as string, options.args || [], {
      name: options.name || 'xterm-256color',
      cols: options.cols || 100,
      rows: options.rows || 30,
      cwd: options.cwd,
      env: ptyEnv,
    });
    (ptyProcess as IPty).bin = options.shellPath as string;
    (ptyProcess as IPty).launchConfig = options;
    const match = (options.shellPath as string).match(/[\w|.]+$/);
    (ptyProcess as IPty).parsedName = match ? match[0] : 'sh';
    return ptyProcess as IPty;
  }

  resize(termninal: pty.IPty, rows: number, cols: number) {
    try {
      termninal.resize(cols, rows);
    } catch (e) {
      return false;
    }

    return true;
  }
}
