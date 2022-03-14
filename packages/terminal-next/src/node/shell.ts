/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from:
// - https://github.com/microsoft/vscode/blob/1.63.0/src/vs/platform/terminal/node/terminalEnvironment.ts
// - https://github.com/microsoft/vscode/blob/ff383268424b1d4b6620e7ea197fb13ae513414f/src/vs/base/node/shell.ts

import fs from 'fs';
import { userInfo, release } from 'os';

import * as path from '@opensumi/ide-core-common/lib/path';
import { IProcessEnvironment, isLinux, isMacintosh, OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import { isWindows } from '@opensumi/ide-core-node';

export const WINDOWS_GIT_BASH_PATHS = [
  `${process.env['ProgramW6432']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`,
  `${process.env['UserProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
  `${process.env['AllUsersProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
];

export async function getPowershellPaths() {
  const paths: string[] = [];
  // TODO: 引入 VSCODE 查找逻辑
  // Add all of the different kinds of PowerShells
  // for await (const pwshExe of enumeratePowerShellInstallations()) {
  //   paths.push(pwshExe.exePath);
  // }
  paths.push('powershell.exe');
  return paths;
}

export const exists = async (p: string) => {
  try {
    await fs.promises.access(path.normalize(p));
    return p;
  } catch {
    return;
  }
};

export async function findShellExecutableAsync(candidate: string[]): Promise<string | undefined> {
  if (candidate.length === 0) {
    return undefined;
  }
  // return the first exists one
  return Promise.all(candidate.map((v) => findExecutable(v))).then((v) => v.find(Boolean));
}

/**
 * @deprecated use findShellExecutableAsync
 */
export function findShellExecutable(candidate: string[]): string | undefined {
  if (candidate.length === 0) {
    return undefined;
  }

  for (const p of candidate) {
    if (fs.existsSync(path.normalize(p))) {
      return p;
    }
    continue;
  }
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
  for (const pathEntry of paths) {
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

export function getWindowsBuildNumber(): number {
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(release());
  let buildNumber = 0;
  if (osVersion && osVersion.length === 4) {
    buildNumber = parseInt(osVersion[3], 10);
  }
  return buildNumber;
}

/**
 * Gets the detected default shell for the _system_, not to be confused with VS Code's _default_
 * shell that the terminal uses by default.
 * @param os The platform to detect the shell of.
 */
export async function getSystemShell(os: OperatingSystem): Promise<string> {
  if (os === OperatingSystem.Windows) {
    if (isWindows) {
      return getSystemShellWindows();
    }
    // Don't detect Windows shell when not on Windows
    return getWindowsShell();
  }
  return getSystemShellUnixLike(os);
}

let _TERMINAL_DEFAULT_SHELL_UNIX_LIKE: string | null = null;
function getSystemShellUnixLike(os: OperatingSystem, env = process.env): string {
  // Only use $SHELL for the current OS
  if ((isLinux && os === OperatingSystem.Macintosh) || (isMacintosh && os === OperatingSystem.Linux)) {
    return '/bin/bash';
  }

  if (!_TERMINAL_DEFAULT_SHELL_UNIX_LIKE) {
    let unixLikeTerminal: string | undefined;

    unixLikeTerminal = env['SHELL'];

    if (!unixLikeTerminal) {
      try {
        // It's possible for $SHELL to be unset, this API reads /etc/passwd. See https://github.com/github/codespaces/issues/1639
        // Node docs: "Throws a SystemError if a user has no username or homedir."
        unixLikeTerminal = userInfo().shell;
      } catch (err) {}
    }

    if (!unixLikeTerminal) {
      unixLikeTerminal = 'sh';
    }

    // Some systems have $SHELL set to /bin/false which breaks the terminal
    if (unixLikeTerminal === '/bin/false') {
      unixLikeTerminal = '/bin/bash';
    }

    _TERMINAL_DEFAULT_SHELL_UNIX_LIKE = unixLikeTerminal;
  }
  return _TERMINAL_DEFAULT_SHELL_UNIX_LIKE;
}

export function getWindowsShell(env = process.env): string {
  return env['comspec'] || 'cmd.exe';
}

let _TERMINAL_DEFAULT_SHELL_WINDOWS: string | null = null;
async function getSystemShellWindows(env = process.env): Promise<string> {
  if (!_TERMINAL_DEFAULT_SHELL_WINDOWS) {
    const isAtLeastWindows10 = isWindows && parseFloat(release()) >= 10;
    const is32ProcessOn64Windows = env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const powerShellPath = `${env['windir']}\\${
      is32ProcessOn64Windows ? 'Sysnative' : 'System32'
    }\\WindowsPowerShell\\v1.0\\powershell.exe`;
    _TERMINAL_DEFAULT_SHELL_WINDOWS = isAtLeastWindows10 ? powerShellPath : getWindowsShell(env);
    return _TERMINAL_DEFAULT_SHELL_WINDOWS;
  }
  return _TERMINAL_DEFAULT_SHELL_WINDOWS;
}
