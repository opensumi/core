export const WINDOWS_DEFAULT_SHELL_PATH_MAPS = {
  powershell: 'powershell.exe',
  cmd: 'cmd.exe',
};

export enum WindowsShellType {
  'cmd' = 'cmd',
  'powershell' = 'powershell',
  'git-bash' = 'git-bash',
}

export type ShellType = WindowsShellType | string;
