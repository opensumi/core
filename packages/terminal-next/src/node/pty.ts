import * as os from 'os';
import * as pty from 'node-pty';
import * as shellPath from 'shell-path';
import * as osLocale from 'os-locale';
import * as omit from 'lodash.omit';
import { TerminalOptions } from '../common';

export { pty };

export interface IPty extends pty.IPty {
  bin: string;
}

const defaultWindowsType = 'powershell.exe';

export class PtyService {
  create(rows: number, cols: number, options: TerminalOptions): IPty {
    const bin = options.shellPath || process.env[os.platform() === 'win32' ? defaultWindowsType : 'SHELL'] || '/bin/sh';
    const locale = osLocale.sync();
    let ptyEnv: { [key: string]: string };

    if (options.strictEnv) {
      ptyEnv = options.env as { [key: string]: string };
    } else {
      ptyEnv =  (
        Object.assign({},
          omit(process.env, ['KTELECTRON', 'EXTENSION_HOST_ENTRY', 'EXTENSION_DIR', 'WORKSPACE_DIR', 'CODE_WINDOW_CLIENT_ID', 'VSCODE_NLS_CONFIG', 'ELECTRON_RUN_AS_NODE']),
          {
            LC_ALL: `${locale.replace('-', '_')}.UTF-8`,
            LANG: `${locale.replace('-', '_')}.UTF-8`,
            PATH: shellPath.sync(),
          },
          options.env,
        )) as { [key: string]: string };
    }
    const ptyProcess = pty.spawn(bin, [], {
      name: 'xterm-color',
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
