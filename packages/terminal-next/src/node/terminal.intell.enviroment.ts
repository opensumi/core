import { spawn } from 'node:child_process';
import fsAsync from 'node:fs/promises';
import path from 'node:path';

import { Autowired, Injectable } from '@opensumi/di';
import { INodeLogger } from '@opensumi/ide-core-node';

import {
  ITerminalIntellEnvironment,
  ITerminalIntellLogger,
  Shell,
  TerminalIntellFileSystem,
} from '../common/intell/environment';
import { CommandToken } from '../common/intell/parser';

export const getPathSeperator = (shell: Shell) =>
  shell === Shell.Bash || shell === Shell.Xonsh || shell === Shell.Nushell ? '/' : path.sep;

// Terminal 智能补全所需要的环境
@Injectable()
export class TerminalIntellEnviromentNode implements ITerminalIntellEnvironment {
  @Autowired(INodeLogger)
  protected readonly logger: INodeLogger;

  private nodeFS = {
    readdir: fsAsync.readdir,
    stat: fsAsync.stat,
  };

  async getFileSystem(): Promise<TerminalIntellFileSystem> {
    return this.nodeFS;
  }

  buildExecuteShellCommand(timeout: number): Fig.ExecuteCommandFunction {
    return async ({ command, env, args, cwd }: Fig.ExecuteCommandInput): Promise<Fig.ExecuteCommandOutput> => {
      const realEnv = env || process.env;
      const child = spawn(command, args, { cwd, env: { ...realEnv, ISTERM: '1' } });
      setTimeout(() => child.kill('SIGKILL'), timeout);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data) => (stdout += data));
      child.stderr.on('data', (data) => (stderr += data));
      child.on('error', (err) => {
        this.logger.debug({ msg: 'shell command failed', e: err.message });
      });
      return new Promise((resolve) => {
        child.on('close', (code) => {
          this.logger.debug({
            msg: 'shell command done',
            command,
            args,
            stdout: stdout.substring(0, 1000),
            stderr,
            code,
          });
          resolve({
            status: code ?? 0,
            stderr,
            stdout,
          });
        });
      });
    };
  }
  async resolveCwd(
    cmdToken: CommandToken | undefined,
    cwd: string,
    shell: Shell,
  ): Promise<{ cwd: string; pathy: boolean; complete: boolean }> {
    if (cmdToken == null) {
      return { cwd, pathy: false, complete: false };
    }
    const { token: rawToken, isQuoted } = cmdToken;
    const token = !isQuoted ? rawToken.replaceAll('\\ ', ' ') : rawToken;
    const sep = getPathSeperator(shell);
    if (!token.includes(sep)) {
      return { cwd, pathy: false, complete: false };
    }
    const resolvedCwd = path.isAbsolute(token) ? token : path.join(cwd, token);
    try {
      await fsAsync.access(resolvedCwd, fsAsync.constants.R_OK);
      return { cwd: resolvedCwd, pathy: true, complete: token.endsWith(sep) };
    } catch {
      // fallback to the parent folder if possible
      const baselessCwd = resolvedCwd.substring(0, resolvedCwd.length - path.basename(resolvedCwd).length);
      try {
        await fsAsync.access(baselessCwd, fsAsync.constants.R_OK);
        return { cwd: baselessCwd, pathy: true, complete: token.endsWith(sep) };
      } catch {
        // empty
      }
      return { cwd, pathy: false, complete: false };
    }
  }
  async getEnv(): Promise<Record<string, string | undefined>> {
    return process.env;
  }
  getLogger(): ITerminalIntellLogger {
    return this.logger;
  }
}
