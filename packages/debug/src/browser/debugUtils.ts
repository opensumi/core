import { equalsIgnoreCase } from '@opensumi/ide-core-browser';

import { DebugConfiguration } from '../common';

export function isExtensionHostDebugging(config: DebugConfiguration) {
  return (
    config.type &&
    equalsIgnoreCase(
      config.type === 'vslsShare' ? (config as any).adapterProxy.configuration.type : config.type,
      'extensionhost',
    )
  );
}

export function matchAll(str: string, regexp: RegExp) {
  let match: RegExpExecArray | null;
  const res: RegExpExecArray[] = [];
  while ((match = regexp.exec(str)) !== null) {
    res.push(match);
  }
  return res;
}

/**
 * request 为 attach 时，排除连接非远程机器 ip 的情况
 */
export function isRemoteAttach(config: DebugConfiguration): boolean {
  if (config.request === 'attach') {
    /**
     * key: 调试语言 type
     * value: 不同语言的调试插件在 attach 模式下. 要 attach 上的 TCP/IP 地址所对应的 launch 属性
     */
    const map = {
      node: 'address',
      java: 'hostName',
      go: 'host',
      cppdbg: 'miDebuggerServerAddress',
      python: 'host',
    };

    const { type } = config;
    const host = config[map[type]];

    if (host) {
      return !['localhost', '0.0.0.0', '::1'].includes(host);
    }

    return true;
  }
  return false;
}

export const USUAL_WORD_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';

/**
 * Create a word definition regular expression based on default word separators.
 * Optionally provide allowed separators that should be included in words.
 *
 * The default would look like this:
 * /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
 */
function createWordRegExp(allowInWords = ''): RegExp {
  let source = '(-?\\d*\\.\\d\\w*)|([^';
  for (const sep of USUAL_WORD_SEPARATORS) {
    if (allowInWords.indexOf(sep) >= 0) {
      continue;
    }
    source += '\\' + sep;
  }
  source += '\\s]+)';
  return new RegExp(source, 'g');
}

// catches numbers (including floating numbers) in the first group, and alphanum in the second
export const DEFAULT_WORD_REGEXP = createWordRegExp();

export class CharWidthReader {
  private static _INSTANCE: CharWidthReader | null = null;

  public static getInstance(): CharWidthReader {
    if (!CharWidthReader._INSTANCE) {
      CharWidthReader._INSTANCE = new CharWidthReader();
    }
    return CharWidthReader._INSTANCE;
  }

  private readonly _cache: Map<string, number>;
  private readonly _canvas: HTMLCanvasElement;

  private constructor() {
    this._cache = new Map();
    this._canvas = document.createElement('canvas');
  }

  public getCharWidth(char: string, font: string): number {
    const cacheKey = char + font;
    if (this._cache.has(cacheKey)) {
      return this._cache.get(cacheKey)!;
    }

    const context = this._canvas.getContext('2d')!;
    context.font = font;
    const metrics = context.measureText(char);
    const width = metrics.width;
    this._cache.set(cacheKey, width);
    return width;
  }
}
