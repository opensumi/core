import * as pty from 'node-pty';
import * as osLocale from 'os-locale';
import omit from 'lodash.omit';
import { IShellLaunchConfig } from '../common';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';
import { INodeLogger } from '@opensumi/ide-core-node';
import { Injectable, Autowired } from '@opensumi/di';

export { pty };

export interface IPty extends pty.IPty {
  /**
   * @deprecated 请使用 `IPty.launchConfig` 的 shellPath 字段
   */
  bin: string;
  launchConfig: IShellLaunchConfig;
  parsedName: string;
}

export const IPtyService = Symbol('IPtyService');

@Injectable()
export class PtyService {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  async create2(options: IShellLaunchConfig) {
    if (!options.shellPath) {
      throw new Error('cannot start shell because: empty shellPath');
    }

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

    const ptyProcess = pty.spawn(options.shellPath, options.args || [], {
      name: options.name || 'xterm-256color',
      cols: options.cols || 100,
      rows: options.rows || 30,
      cwd: options.cwd,
      env: ptyEnv,
    });
    (ptyProcess as IPty).bin = options.shellPath;
    (ptyProcess as IPty).launchConfig = options;
    const match = options.shellPath.match(/[\w|.]+$/);
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
