import { isWindows, isElectronRenderer } from '@opensumi/ide-core-common';

export function getElectronEnv(): any {
  return (global as any).env || {};
}

export function useNativeTopMenu() {
  if (isElectronRenderer()) {
    if (getElectronEnv().USE_NATIVE_TOP_MENU !== undefined) {
      return getElectronEnv().USE_NATIVE_TOP_MENU === '1';
    } else {
      return !isWindows;
    }
  }
  return false;
}

export function useNativeContextMenu() {
  if (isElectronRenderer()) {
    if (getElectronEnv().USE_NATIVE_CONTEXT_MENU !== undefined) {
      return getElectronEnv().USE_NATIVE_CONTEXT_MENU === '1';
    }
    return true;
  }
  return false;
}
