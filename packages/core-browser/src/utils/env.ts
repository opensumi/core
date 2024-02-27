import { isElectronRenderer, isWindows } from '@opensumi/ide-core-common';

export function getElectronEnv(): any {
  return (global as any).env || {};
}

/**
 * @deprecated useNativeTopMenu will be removed in v2.26, please use appConfig#isElectronRenderer instead.
 */
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

/**
 * @deprecated useNativeContextMenu will be removed in v2.26, please use appConfig#isElectronRenderer instead.
 */
export function useNativeContextMenu() {
  if (isElectronRenderer()) {
    if (getElectronEnv().USE_NATIVE_CONTEXT_MENU !== undefined) {
      return getElectronEnv().USE_NATIVE_CONTEXT_MENU === '1';
    }
    return true;
  }
  return false;
}
