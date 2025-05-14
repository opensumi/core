/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// 行号和列号的正则生成函数
class LinkMatchCounters {
  private ri = 0;
  private ci = 0;
  private rei = 0;
  private cei = 0;

  r(): string {
    return `(?<row${this.ri++}>\\d+)`;
  }

  c(): string {
    return `(?<col${this.ci++}>\\d+)`;
  }

  re(): string {
    return `(?<rowEnd${this.rei++}>\\d+)`;
  }

  ce(): string {
    return `(?<colEnd${this.cei++}>\\d+)`;
  }
}

// 路径相关的正则表达式
export const pathPrefix = '(\\.\\.?|\\~)';
export const pathSeparatorClause = '\\/';
export const excludedPathCharactersClause = '[^\\0\\s!`&*()\\[\\]\'":;\\\\]';
export const winDrivePrefix = '(?:\\\\\\\\\\?\\\\)?[a-zA-Z]:';
export const winPathPrefix = '(' + winDrivePrefix + '|\\.\\.?|\\~)';
export const winPathSeparatorClause = '(\\\\|\\/)';
export const winExcludedPathCharactersClause = '[^\\0<>\\?\\|\\/\\s!`&*()\\[\\]\'":;]';

// Unix 和 Windows 的本地链接正则表达式
export const unixLocalLinkClause =
  '((' +
  pathPrefix +
  '|(' +
  excludedPathCharactersClause +
  ')+)?(' +
  pathSeparatorClause +
  '(' +
  excludedPathCharactersClause +
  ')+)+)';

export const winLocalLinkClause =
  '((' +
  winPathPrefix +
  '|(' +
  winExcludedPathCharactersClause +
  ')+)?(' +
  winPathSeparatorClause +
  '(' +
  winExcludedPathCharactersClause +
  ')+)+)';

// 行号和列号的匹配正则表达式
const eolSuffix = '';

/** As xterm reads from DOM, space in that case is nonbreaking char ASCII code - 160,
replacing space with nonBreakningSpace or space ASCII code - 32. */
export function getLineAndColumnClause(): string {
  const counters = new LinkMatchCounters();

  return [
    // foo:339
    // foo:339:12
    // foo:339:12-789
    // foo:339:12-341.789
    // foo:339.12
    // foo 339
    // foo 339:12                              [#140780]
    // foo 339.12
    // foo#339
    // foo#339:12                              [#190288]
    // foo#339.12
    // foo, 339                                [#217927]
    // "foo",339
    // "foo",339:12
    // "foo",339.12
    // "foo",339.12-789
    // "foo",339.12-341.789
    `(?::|#| |['"],|, )${counters.r()}([:.]${counters.c()}(?:-(?:${counters.re()}\\.)?${counters.ce()})?)?` + eolSuffix,
    // The quotes below are optional           [#171652]
    // "foo", line 339                         [#40468]
    // "foo", line 339, col 12
    // "foo", line 339, column 12
    // "foo":line 339
    // "foo":line 339, col 12
    // "foo":line 339, column 12
    // "foo": line 339
    // "foo": line 339, col 12
    // "foo": line 339, column 12
    // "foo" on line 339
    // "foo" on line 339, col 12
    // "foo" on line 339, column 12
    // "foo" line 339 column 12
    // "foo", line 339, character 12           [#171880]
    // "foo", line 339, characters 12-789      [#171880]
    // "foo", lines 339-341                    [#171880]
    // "foo", lines 339-341, characters 12-789 [#178287]
    `['"]?(?:,? |: ?| on )lines? ${counters.r()}(?:-${counters.re()})?(?:,? (?:col(?:umn)?|characters?) ${counters.c()}(?:-${counters.ce()})?)?` +
      eolSuffix,
    // () and [] are interchangeable
    // foo(339)
    // foo(339,12)
    // foo(339, 12)
    // foo (339)
    // foo (339,12)
    // foo (339, 12)
    // foo: (339)
    // foo: (339,12)
    // foo: (339, 12)
    // foo(339:12)                             [#229842]
    // foo (339:12)                            [#229842]
    `:? ?[\\[\\(]${counters.r()}(?:(?:, ?|:)${counters.c()})?[\\]\\)]` + eolSuffix,
  ]
    .join('|')
    .replace(/ /g, `[${'\u00A0'} ]`);
}

// 行号和列号匹配的索引
export const winLineAndColumnMatchIndex = 12;
export const unixLineAndColumnMatchIndex = 11;

// 行号和列号子句的组数
export const lineAndColumnClauseGroupCount = 6;

// 链接信息接口
export interface ILinkInfo {
  filePath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

// 最大长度限制
export const MAX_LENGTH = 2000;

/**
 * 从正则匹配结果中提取行号信息
 */
export function extractLineInfoFromMatch(match: RegExpExecArray): ILinkInfo {
  const result: any = {};

  // 提取文件路径（第一个捕获组）
  if (match[1]) {
    result.filePath = match[1];
  }

  // 提取命名捕获组中的行号信息
  if (match.groups) {
    for (const [key, value] of Object.entries(match.groups)) {
      if (!value) {
        continue;
      }

      if (key.startsWith('row')) {
        const index = key.replace('row', '');
        if (index === 'End') {
          result.endLine = parseInt(value, 10);
        } else {
          result.line = parseInt(value, 10);
        }
      } else if (key.startsWith('col')) {
        const index = key.replace('col', '');
        if (index === 'End') {
          result.endColumn = parseInt(value, 10);
        } else {
          result.column = parseInt(value, 10);
        }
      }
    }
  }

  return result;
}
