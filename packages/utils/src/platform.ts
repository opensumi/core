/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/microsoft/vscode/blob/01d1ea52e639615c4513689ce66576829438f748/src/vs/base/common/platform.ts

import { isString } from './types';

export const LANGUAGE_DEFAULT = 'en';

let _isWindows = false;
let _isMacintosh = false;
let _isLinux = false;
let _isNative = false;
let _isWeb = false;
let _locale: string | undefined;
let _language: string = LANGUAGE_DEFAULT;
let _translationsConfigFile: string | undefined;
let _isWebKit = false;

interface NLSConfig {
  locale: string;
  availableLanguages: { [key: string]: string };
  _translationsConfigFile: string;
}

export interface IProcessEnvironment {
  [key: string]: string | null | undefined;
}

interface INodeProcess {
  platform: string;
  env: IProcessEnvironment;
  getuid(): number;
  nextTick: any;
  versions?: {
    electron?: string;
    node?: string;
    chrome?: string;
  };
  type?: string;
}
declare const process: INodeProcess;
declare const global: any;

let nodeProcess: INodeProcess | undefined;
if (typeof process !== 'undefined' && typeof process?.versions?.node === 'string') {
  nodeProcess = process;
}

interface INavigator {
  userAgent: string;
  language: string;
}
declare const navigator: INavigator;
declare const self: any;

const isElectronRenderer = nodeProcess && isString(nodeProcess?.versions?.electron) && nodeProcess.type === 'renderer';
const isNodeNavigator =
  typeof navigator === 'object' && isString(navigator.userAgent) && navigator.userAgent.startsWith('Node.js');

// OS detection
if (typeof navigator === 'object' && !isNodeNavigator && !isElectronRenderer) {
  const userAgent = navigator.userAgent;
  // Node 21+ has navigator property
  _isWindows = userAgent.indexOf('Windows') >= 0;
  _isMacintosh = userAgent.indexOf('Macintosh') >= 0;
  _isLinux = userAgent.indexOf('Linux') >= 0;
  _isWeb = true;
  _locale = navigator.language;
  _language = _locale;
  _isWebKit = userAgent.indexOf('AppleWebKit') >= 0;
} else if (typeof nodeProcess === 'object') {
  _isWindows = nodeProcess.platform === 'win32';
  _isMacintosh = nodeProcess.platform === 'darwin';
  _isLinux = nodeProcess.platform === 'linux';
  _locale = LANGUAGE_DEFAULT;
  _language = LANGUAGE_DEFAULT;
  const rawNlsConfig = nodeProcess.env['VSCODE_NLS_CONFIG'];
  if (rawNlsConfig) {
    try {
      const nlsConfig: NLSConfig = JSON.parse(rawNlsConfig);
      const resolved = nlsConfig.availableLanguages['*'];
      _locale = nlsConfig.locale;
      // VSCode's default language is 'en'
      _language = resolved ? resolved : LANGUAGE_DEFAULT;
      _translationsConfigFile = nlsConfig._translationsConfigFile;
    } catch (e) {}
  }
  _isNative = true;
}

export const enum Platform {
  Web,
  Mac,
  Linux,
  Windows,
}

export function PlatformToString(platform: Platform) {
  switch (platform) {
    case Platform.Web:
      return 'Web';
    case Platform.Mac:
      return 'Mac';
    case Platform.Linux:
      return 'Linux';
    case Platform.Windows:
      return 'Windows';
  }
}

let _platform: Platform = Platform.Web;
if (_isNative) {
  if (_isMacintosh) {
    _platform = Platform.Mac;
  } else if (_isWindows) {
    _platform = Platform.Windows;
  } else if (_isLinux) {
    _platform = Platform.Linux;
  }
}

export const isWindows = _isWindows;
export const isMacintosh = _isMacintosh;
export const isOSX = _isMacintosh;
export const isLinux = _isLinux;
export const isNative = _isNative;
export const isWeb = _isWeb;
export const platform = _platform;
export const isWebKit = _isWebKit;

export function isRootUser(): boolean {
  return _isNative && !_isWindows && process.getuid() === 0;
}

/**
 * The language used for the user interface. The format of
 * the string is all lower case (e.g. zh-tw for Traditional
 * Chinese)
 */
export const language = _language;

export namespace Language {
  export function value(): string {
    return language;
  }

  export function isDefaultVariant(): boolean {
    if (language.length === 2) {
      return language === 'en';
    } else if (language.length >= 3) {
      return language[0] === 'e' && language[1] === 'n' && language[2] === '-';
    } else {
      return false;
    }
  }

  export function isDefault(): boolean {
    return language === 'en';
  }
}

/**
 * The OS locale or the locale specified by --locale. The format of
 * the string is all lower case (e.g. zh-tw for Traditional
 * Chinese). The UI is not necessarily shown in the provided locale.
 */
export const locale = _locale;

/**
 * The translatios that are available through language packs.
 */
export const translationsConfigFile = _translationsConfigFile;

const _globals = typeof self === 'object' ? self : typeof global === 'object' ? global : ({} as any);
export const globals: any = _globals;

let _setImmediate: ((callback: (...args: any[]) => void) => number) | null = null;
export function setImmediate(callback: (...args: any[]) => void): number {
  if (_setImmediate === null) {
    if (globals.setImmediate) {
      _setImmediate = globals.setImmediate.bind(globals);
    } else if (typeof process !== 'undefined' && typeof process.nextTick === 'function') {
      _setImmediate = process.nextTick.bind(process);
    } else {
      _setImmediate = globals.setTimeout.bind(globals);
    }
  }
  return _setImmediate!(callback);
}

export enum OperatingSystem {
  Windows = 1,
  Macintosh = 2,
  Linux = 3,
}

export const userAgent = typeof navigator === 'object' ? navigator.userAgent : null;

export const isChrome = userAgent?.indexOf('Chrome')! >= 0;
export const isSafari = !isChrome && userAgent?.indexOf('Safari')! >= 0;
