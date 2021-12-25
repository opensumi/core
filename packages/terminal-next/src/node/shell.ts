import { normalize } from '@opensumi/ide-core-common';
import fs from 'fs';

// TODO: 用户装在 D 盘的不就识别不对了
export const WINDOWS_GIT_BASH_PATHS = [
  `${process.env['ProgramW6432']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramW6432']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\bin\\bash.exe`,
  `${process.env['ProgramFiles']}\\Git\\usr\\bin\\bash.exe`,
  `${process.env['LocalAppData']}\\Programs\\Git\\bin\\bash.exe`,
  `${process.env['UserProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
  `${process.env['AllUsersProfile']}\\scoop\\apps\\git-with-openssh\\current\\bin\\bash.exe`,
];

export const exists = async (p: string) => {
  try {
    p = normalize(p);
    await fs.promises.access(p);
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
  return Promise.all(candidate.map(exists)).then((v) => v.find(Boolean));
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
