import { normalize } from '@ali/ide-core-common';
import fs from 'fs';

export const WINDOWS_GIT_BASH_PATHS = [
  `${process.env['ProgramW6432']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`,
  `${process.env['UserProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
  `${process.env['AllUsersProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
];

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
