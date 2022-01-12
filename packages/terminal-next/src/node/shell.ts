/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Some code copied and modified from https://github.com/microsoft/vscode/blob/1.63.0/src/vs/platform/terminal/node/terminalEnvironment.ts

import os from 'os';
import fs from 'fs';

import { normalize } from '@opensumi/ide-core-common';
import { IProcessEnvironment } from '@opensumi/ide-core-common/lib/platform';
import * as path from '@opensumi/ide-core-common/lib/path';
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
    await fs.promises.access(normalize(p));
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
    if (fs.existsSync(normalize(p))) {
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
  const osVersion = /(\d+)\.(\d+)\.(\d+)/g.exec(os.release());
  let buildNumber = 0;
  if (osVersion && osVersion.length === 4) {
    buildNumber = parseInt(osVersion[3], 10);
  }
  return buildNumber;
}
