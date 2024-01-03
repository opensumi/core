import { strings } from '@opensumi/ide-core-browser';
import { SnippetParser } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/snippet/browser/snippetParser';

import { DebugConfiguration } from '../common';

const { equalsIgnoreCase } = strings;

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
      return !['localhost', '0.0.0.0', '127.0.0.1', '::1'].includes(host);
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

export const parseSnippet = (value: string) => {
  /**
   * 在 Windows 中, 直接使用 \" 来转义双引号可能会被解析为文件路径中的反斜杠，从而导致路径错误。
   * 为了避免这个问题，一些插件内使用 ^\" 来表示转义的双引号，这样就不会被解析为文件路径中的反斜杠了。
   * 当调试器解析 launch.json 文件并读取字符串值时，它会将 ^" 转换为双引号。
   * 而我们在这里为了需要把转义后的字符串能正确展示，就需要用正则去剔除
   */
  const doubleQuotesRegex = new RegExp(/^\^\"(.*)\"/gm);
  /**
   * 使用 monaco 内部的 SnippetParser 来转换形如 ${1:xxxx} 这样的符号
   */
  const snippet = new SnippetParser();
  const isHasSnippetRegex = new RegExp(/\${\d+:(.*)/);

  if (isHasSnippetRegex.test(value) || doubleQuotesRegex.test(value)) {
    const snippetParse = snippet.parse(value).toString();
    return snippetParse.replace(doubleQuotesRegex, '$1');
  }

  return value;
};
