import { normalize } from '@opensumi/ide-core-common';
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

export const exists = async (p: string) => {
  try {
    p = normalize(p);
    await fs.promises.access(p);
    return p;
  } catch (error) {}
};

export async function findShellExecutableAsync(candidate: string[]): Promise<string | undefined> {
  if (candidate.length === 0) {
    return undefined;
  }
  const toPromise = candidate.map(exists);
  return Promise.all(toPromise).then((lists) => {
    for (const v of lists) {
      if (v) {
        return v;
      }
    }
  });
}

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
