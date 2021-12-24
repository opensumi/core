import * as pty from 'node-pty';
import * as osLocale from 'os-locale';
import omit from 'lodash.omit';
import { IShellLaunchConfig } from '../common';
import { IPty } from '../common/pty';
import { exists } from './shell';
import { getShellPath } from '@opensumi/ide-core-node/lib/bootstrap/shell-path';
import { INodeLogger, isWindows } from '@opensumi/ide-core-node';
import { Injectable, Autowired } from '@opensumi/di';
import { promises } from 'fs';
import * as path from '@opensumi/ide-core-common/lib/path';
export { pty };

export const IPtyService = Symbol('IPtyService');
export interface IProcessEnvironment {
  [key: string]: string | undefined;
}

export function getCaseInsensitive(target: Record<string, any>, key: string): any {
  const lowercaseKey = key.toLowerCase();
  const equivalentKey = Object.keys(target).find((k) => k.toLowerCase() === lowercaseKey);
  return equivalentKey ? target[equivalentKey] : target[key];
}

export async function findExecutable(
  command: string,
  cwd?: string,
  paths?: string[],
  env: IProcessEnvironment = process.env as IProcessEnvironment,
): Promise<string | undefined> {
  // If we have an absolute path then we take it.
  if (path.isAbsolute(command)) {
    return (await exists(command)) ? command : undefined;
  }
  if (cwd === undefined) {
    cwd = process.cwd();
  }
  const dir = path.dirname(command);
  if (dir !== '.') {
    // We have a directory and the directory is relative (see above). Make the path absolute
    // to the current working directory.
    const fullPath = path.join(cwd, command);
    return (await exists(fullPath)) ? fullPath : undefined;
  }
  const envPath = getCaseInsensitive(env, 'PATH');
  if (paths === undefined && typeof envPath === 'string') {
    paths = envPath.split(path.delimiter);
  }
  // No PATH environment. Make path absolute to the cwd.
  if (paths === undefined || paths.length === 0) {
    const fullPath = path.join(cwd, command);
    return (await exists(fullPath)) ? fullPath : undefined;
  }
  // We have a simple file name. We get the path variable from the env
  // and try to find the executable on the path.
  for (let pathEntry of paths) {
    // The path entry is absolute.
    let fullPath: string;
    if (path.isAbsolute(pathEntry)) {
      fullPath = path.join(pathEntry, command);
    } else {
      fullPath = path.join(cwd, pathEntry, command);
    }

    if (await exists(fullPath)) {
      return fullPath;
    }
    if (isWindows) {
      let withExtension = fullPath + '.com';
      if (await exists(withExtension)) {
        return withExtension;
      }
      withExtension = fullPath + '.exe';
      if (await exists(withExtension)) {
        return withExtension;
      }
    }
  }
  const fullPath = path.join(cwd, command);
  return (await exists(fullPath)) ? fullPath : undefined;
}

@Injectable()
export class PtyService {
  @Autowired(INodeLogger)
  private readonly logger: INodeLogger;

  async create2(options: IShellLaunchConfig) {
    if (!options.shellPath) {
      throw new Error('options.shellPath not set');
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

    try {
      const result = await promises.stat(options.shellPath);
      if (!result.isFile() && !result.isSymbolicLink()) {
        throw new Error(`Path to shell executable "${options.shellPath}" is not a file or a symlink`);
      }
    } catch (err) {
      if (err?.code === 'ENOENT') {
        // The executable isn't an absolute path, try find it on the PATH or CWD
        const envPaths: string[] | undefined =
          options.env && options.env.PATH ? options.env.PATH.split(path.delimiter) : undefined;
        const executable = await findExecutable(options.shellPath, options.cwd, envPaths, ptyEnv);
        if (!executable) {
          throw new Error(`Path to shell shellPath "${options.shellPath}" does not exist`);
        }
        // Set the shellPath explicitly here so that node-pty doesn't need to search the
        // $PATH too.
        options.shellPath = executable;
      }
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
