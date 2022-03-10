/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Some code copied and modified from https://github.com/Microsoft/vscode/blob/bf7ac9201e7a7d01741d4e6e64b5dc9f3197d97b/src/vs/base/common/paths.ts

'use strict';

import { CharCode } from '../charCode';
import { posix } from '../path';
import { isWindows } from '../platform';

import { startsWithIgnoreCase } from './strings';

/**
 * The forward slash path separator.
 */
export const sep = '/';

/**
 * The native path separator depending on the OS.
 */
export const nativeSep = isWindows ? '\\' : '/';

const _posixBadPath = /(\/\.\.?\/)|(\/\.\.?)$|^(\.\.?\/)|(\/\/+)|(\\)/;
const _winBadPath = /(\\\.\.?\\)|(\\\.\.?)$|^(\.\.?\\)|(\\\\+)|(\/)/;

/**
 * Takes a Windows OS path and changes backward slashes to forward slashes.
 * This should only be done for OS paths from Windows (or user provided paths potentially from Windows).
 * Using it on a Linux or MaxOS path might change it.
 */
export function toSlashes(osPath: string) {
  return osPath.replace(/[\\/]/g, posix.sep);
}

function _isNormal(path: string, win: boolean): boolean {
  return win ? !_winBadPath.test(path) : !_posixBadPath.test(path);
}

/**
 * @returns the base name of a path.
 */
export function basename(path: string): string {
  const idx = ~path.lastIndexOf('/') || ~path.lastIndexOf('\\');
  if (idx === 0) {
    return path;
  } else if (~idx === path.length - 1) {
    return basename(path.substring(0, path.length - 1));
  } else {
    return path.substr(~idx + 1);
  }
}

/**
 * @returns `.far` from `boo.far` or the empty string.
 */
export function extname(path: string): string {
  path = basename(path);
  const idx = ~path.lastIndexOf('.');
  return idx ? path.substring(~idx) : '';
}

export function normalize(path: string, toOSPath?: boolean): string {
  if (path === null || path === void 0) {
    return path;
  }

  const len = path.length;
  if (len === 0) {
    return '.';
  }

  const wantsBackslash = isWindows && toOSPath;
  if (_isNormal(path, wantsBackslash!)) {
    return path;
  }

  const sep = wantsBackslash ? '\\' : '/';
  const root = getRoot(path, sep);

  // skip the root-portion of the path
  let start = root.length;
  let skip = false;
  let res = '';

  for (let end = root.length; end <= len; end++) {
    // either at the end or at a path-separator character
    if (end === len || path.charCodeAt(end) === CharCode.Slash || path.charCodeAt(end) === CharCode.Backslash) {
      if (streql(path, start, end, '..')) {
        // skip current and remove parent (if there is already something)
        const prev_start = res.lastIndexOf(sep);
        const prev_part = res.slice(prev_start + 1);
        if ((root || prev_part.length > 0) && prev_part !== '..') {
          res = prev_start === -1 ? '' : res.slice(0, prev_start);
          skip = true;
        }
      } else if (streql(path, start, end, '.') && (root || res || end < len - 1)) {
        // skip current (if there is already something or if there is more to come)
        skip = true;
      }

      if (!skip) {
        const part = path.slice(start, end);
        if (res !== '' && res[res.length - 1] !== sep) {
          res += sep;
        }
        res += part;
      }
      start = end + 1;
      skip = false;
    }
  }

  return root + res;
}

function streql(value: string, start: number, end: number, other: string): boolean {
  return start + other.length === end && value.indexOf(other, start) === start;
}

/**
 * Computes the _root_ this path, like `getRoot('c:\files') === c:\`,
 * `getRoot('files:///files/path') === files:///`,
 * or `getRoot('\\server\shares\path') === \\server\shares\`
 */
export function getRoot(path: string, sep = '/'): string {
  if (!path) {
    return '';
  }

  const len = path.length;
  let code = path.charCodeAt(0);
  if (code === CharCode.Slash || code === CharCode.Backslash) {
    code = path.charCodeAt(1);
    if (code === CharCode.Slash || code === CharCode.Backslash) {
      // UNC candidate \\localhost\shares\ddd
      //               ^^^^^^^^^^^^^^^^^^^
      code = path.charCodeAt(2);
      if (code !== CharCode.Slash && code !== CharCode.Backslash) {
        let pos = 3;
        const start = pos;
        for (; pos < len; pos++) {
          code = path.charCodeAt(pos);
          if (code === CharCode.Slash || code === CharCode.Backslash) {
            break;
          }
        }
        code = path.charCodeAt(pos + 1);
        if (start !== pos && code !== CharCode.Slash && code !== CharCode.Backslash) {
          pos += 1;
          for (; pos < len; pos++) {
            code = path.charCodeAt(pos);
            if (code === CharCode.Slash || code === CharCode.Backslash) {
              return path
                .slice(0, pos + 1) // consume this separator
                .replace(/[\\/]/g, sep);
            }
          }
        }
      }
    }

    // /user/far
    // ^
    return sep;
  } else if ((code >= CharCode.A && code <= CharCode.Z) || (code >= CharCode.a && code <= CharCode.z)) {
    // check for windows drive letter c:\ or c:

    if (path.charCodeAt(1) === CharCode.Colon) {
      code = path.charCodeAt(2);
      if (code === CharCode.Slash || code === CharCode.Backslash) {
        // C:\fff
        // ^^^
        return path.slice(0, 2) + sep;
      } else {
        // C:
        // ^^
        return path.slice(0, 2);
      }
    }
  }

  // check for URI
  // scheme://authority/path
  // ^^^^^^^^^^^^^^^^^^^
  let pos = path.indexOf('://');
  if (pos !== -1) {
    pos += 3; // 3 -> "://".length
    for (; pos < len; pos++) {
      code = path.charCodeAt(pos);
      if (code === CharCode.Slash || code === CharCode.Backslash) {
        return path.slice(0, pos + 1); // consume this separator
      }
    }
  }

  return '';
}

export function isEqualOrParent(path: string, candidate: string, ignoreCase?: boolean): boolean {
  if (path === candidate) {
    return true;
  }

  if (!path || !candidate) {
    return false;
  }

  if (candidate.length > path.length) {
    return false;
  }

  if (ignoreCase) {
    const beginsWith = startsWithIgnoreCase(path, candidate);
    if (!beginsWith) {
      return false;
    }

    if (candidate.length === path.length) {
      return true; // same path, different casing
    }

    let sepOffset = candidate.length;
    if (candidate.charAt(candidate.length - 1) === nativeSep) {
      sepOffset--; // adjust the expected sep offset in case our candidate already ends in separator character
    }

    return path.charAt(sepOffset) === nativeSep;
  }

  if (candidate.charAt(candidate.length - 1) !== nativeSep) {
    candidate += nativeSep;
  }

  return path.indexOf(candidate) === 0;
}

export function resolve(...paths: string[]): string {
  let processed: string[] = [];
  for (const p of paths) {
    if (typeof p !== 'string') {
      throw new TypeError('Invalid argument type to path.join: ' + typeof p);
    } else if (p !== '') {
      if (p.charAt(0) === sep) {
        processed = [];
      }
      processed.push(p);
    }
  }

  const resolved = normalize(processed.join(sep));
  if (resolved.length > 1 && resolved.charAt(resolved.length - 1) === sep) {
    return resolved.substr(0, resolved.length - 1);
  }

  return resolved;
}

export function relative(from: string, to: string): string {
  let i: number;

  from = resolve(from);
  to = resolve(to);
  const fromSegments = from.split(sep);
  const toSegments = to.split(sep);

  toSegments.shift();
  fromSegments.shift();

  let upCount = 0;
  let downSegments: string[] = [];

  for (i = 0; i < fromSegments.length; i++) {
    const seg = fromSegments[i];
    if (seg === toSegments[i]) {
      continue;
    }

    upCount = fromSegments.length - i;
    break;
  }

  downSegments = toSegments.slice(i);

  if (fromSegments.length === 1 && fromSegments[0] === '') {
    upCount = 0;
  }

  if (upCount > fromSegments.length) {
    upCount = fromSegments.length;
  }

  let rv = '';
  for (i = 0; i < upCount; i++) {
    rv += '../';
  }
  rv += downSegments.join(sep);

  if (rv.length > 1 && rv.charAt(rv.length - 1) === sep) {
    rv = rv.substr(0, rv.length - 1);
  }
  return rv;
}

export function replaceAsarInPath(pathMayInAsar: string) {
  const parts = pathMayInAsar.split(normalize('/', true));
  parts.forEach((part, i) => {
    if (part.endsWith('.asar')) {
      parts[i] = part + '.unpacked';
    }
  });
  return parts.join(normalize('/', true));
}

// Reference: https://en.wikipedia.org/wiki/Filename
const WINDOWS_INVALID_FILE_CHARS = /[\\/:*?"<>|]/g;
const UNIX_INVALID_FILE_CHARS = /[\\/]/g;
const WINDOWS_FORBIDDEN_NAMES = /^(con|prn|aux|clock\$|nul|lpt[0-9]|com[0-9])$/i;
export function isValidBasename(name: string | null | undefined, isWindowsOS: boolean = isWindows): boolean {
  const invalidFileChars = isWindowsOS ? WINDOWS_INVALID_FILE_CHARS : UNIX_INVALID_FILE_CHARS;

  if (!name || name.length === 0 || /^\s+$/.test(name)) {
    return false; // require a name that is not just whitespace
  }

  invalidFileChars.lastIndex = 0; // the holy grail of software development
  if (invalidFileChars.test(name)) {
    return false; // check for certain invalid file characters
  }

  if (isWindowsOS && WINDOWS_FORBIDDEN_NAMES.test(name)) {
    return false; // check for certain invalid file names
  }

  if (name === '.' || name === '..') {
    return false; // check for reserved values
  }

  if (isWindowsOS && name[name.length - 1] === '.') {
    return false; // Windows: file cannot end with a "."
  }

  if (isWindowsOS && name.length !== name.trim().length) {
    return false; // Windows: file cannot end with a whitespace
  }

  if (name.length > 255) {
    return false; // most file systems do not allow files > 255 length
  }

  return true;
}
