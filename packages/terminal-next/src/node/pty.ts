import os from 'os';
import * as pty from 'node-pty';
import * as osLocale from 'os-locale';
import omit from 'lodash.omit';
import { TerminalOptions } from '../common';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';

export { pty };

export interface IPty extends pty.IPty {
  bin: string;
}

const defaultWindowsType = 'powershell.exe';

export class PtyService {
  async create(rows: number, cols: number, options: TerminalOptions): Promise<IPty> {
    const bin = options.shellPath || (os.platform() === 'win32' ? defaultWindowsType : (process.env['SHELL'] || '/bin/sh'));
    const locale = osLocale.sync();
    let ptyEnv: { [key: string]: string };

    if (options.strictEnv) {
      ptyEnv = options.env as { [key: string]: string };
    } else {
      ptyEnv = (
        Object.assign({},
          omit(process.env, ['KTELECTRON', 'EXTENSION_HOST_ENTRY', 'EXTENSION_DIR', 'WORKSPACE_DIR', 'CODE_WINDOW_CLIENT_ID', 'VSCODE_NLS_CONFIG', 'ELECTRON_RUN_AS_NODE']),
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
        )) as { [key: string]: string };
    }

    const ptyProcess = pty.spawn(bin, options.shellArgs || [], {
      name: 'xterm-256color',
      cols: cols || 100,
      rows: rows || 30,
      cwd: options.cwd ? options.cwd!.toString() : '',
      env: ptyEnv,
    });
    (ptyProcess as any).bin = bin;
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
