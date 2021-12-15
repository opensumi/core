// Modify from @opensumi/ide-core-common/src/os.ts
function is(userAgent: string, platform: string): boolean {
  if (global.hasOwnProperty('platform')) {
    return (global as any).platform === platform;
  }
  if (typeof process !== 'undefined' && (process.platform as any) !== 'browser') {
    return process.platform === platform;
  }
  if (typeof navigator !== 'undefined') {
    if (navigator.userAgent && navigator.userAgent.indexOf(userAgent) >= 0) {
      return true;
    }
  }
  return false;
}

export const isWindows = is('Windows', 'win32');
export const isOSX = is('Mac', 'darwin');
export const isLinux = is('Linux', 'linux');
