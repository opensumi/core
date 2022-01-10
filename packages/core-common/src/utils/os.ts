/** ******************************************************************************
 * Copyright (C) 2017 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

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

export type CMD = [string, string[]];
export function cmd(command: string, ...args: string[]): CMD {
  return [isWindows ? 'cmd' : command, isWindows ? ['/c', command, ...args] : args];
}

export namespace OS {
  /**
   * Enumeration of the supported operating systems.
   */
  export enum Type {
    Windows = 'Windows',
    Linux = 'Linux',
    OSX = 'OSX',
  }

  /**
   * Returns with the type of the operating system. If it is neither [Windows](isWindows) nor [OS X](isOSX), then
   * it always return with the `Linux` OS type.
   */
  export function type(): OS.Type {
    if (isWindows) {
      return Type.Windows;
    }
    if (isOSX) {
      return Type.OSX;
    }
    return Type.Linux;
  }
}

export function isNodeIntegrated(): boolean {
  return typeof module !== 'undefined' && !!module.exports;
}

/**
 * @deprecated isElectronEnv is deprecated, please use appConfig#isElectronRenderer instead.
 * 框架目前使用 isElectronEnv 的场景基本都与 isElectronRenderer 重复，所以直接废弃 isElectronEnv
 */
export function isElectronEnv(): boolean {
  return isElectronRenderer() || isElectronNode();
}

/**
 * @deprecated isElectronRenderer will deprecate, please use appConfig#isElectronRenderer instead.
 */
export function isElectronRenderer() {
  return (global as any).isElectronRenderer;
}

export function isElectronNode() {
  return process && process.env && !!process.env.ELECTRON_RUN_AS_NODE;
}

export function isDevelopment() {
  return (global as any).isDev || (process && process.env.IS_DEV);
}

/**
 * 在 Electron 中，会将 opensumi 中的 extension-host 使用 webpack 打成一个，所以需要其他方法来获取原始的 require
 */
declare let __webpack_require__: any;
declare let __non_webpack_require__: any;

// https://github.com/webpack/webpack/issues/4175#issuecomment-342931035
export function getNodeRequire() {
  return typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
}
