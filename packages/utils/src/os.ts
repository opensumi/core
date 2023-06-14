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

import { isWindows, isMacintosh, OperatingSystem } from './platform';

export type CMD = [string, string[]];
export function cmd(command: string, ...args: string[]): CMD {
  return [isWindows ? 'cmd' : command, isWindows ? ['/c', command, ...args] : args];
}

export namespace OS {
  export enum Type {
    Windows = OperatingSystem.Windows,
    Linux = OperatingSystem.Linux,
    OSX = OperatingSystem.Macintosh,
  }

  export function type(): OperatingSystem {
    if (isWindows) {
      return OperatingSystem.Windows;
    }
    if (isMacintosh) {
      return OperatingSystem.Macintosh;
    }
    return OperatingSystem.Linux;
  }
}

export function isNodeIntegrated(): boolean {
  return typeof module !== 'undefined' && !!module.exports;
}

export function isElectronEnv(): boolean {
  return isElectronRenderer() || isElectronNode();
}

/**
 * @deprecated isElectronRenderer will be removed in v2.26, please use appConfig#isElectronRenderer instead.
 */
export function isElectronRenderer() {
  return (
    (global as any).isElectronRenderer ||
    (typeof navigator === 'object' &&
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent.indexOf('Electron') >= 0)
  );
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
