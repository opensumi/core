import { URI } from '@opensumi/ide-core-common';

import type {
  IAutoClosingPair,
  IAutoClosingPairConditional,
} from '../browser/monaco-api/types';

export * from '@opensumi/ide-core-browser/lib/monaco';

export interface IRegExp {
	pattern: string;
	flags?: string;
}

export interface IEnterAction {
	indent: 'none' | 'indent' | 'indentOutdent' | 'outdent';
	appendText?: string;
	removeText?: number;
}

export interface IIndentationRule {
  decreaseIndentPattern: IRegExp;
	increaseIndentPattern: IRegExp;
	indentNextLinePattern?: IRegExp;
	unIndentedLinePattern?: IRegExp;
}

export interface IOnEnterRule {
  beforeText: IRegExp;
	afterText?: IRegExp;
	previousLineText?: IRegExp;
	action: IEnterAction;
}

export interface FoldingMarkers {
  start: RegExp;
  end: RegExp;
}

export interface IndentationRuleDto {
  /**
   * Used by the indentation based strategy to decide whether empty lines belong to the previous or the next block.
   * A language adheres to the off-side rule if blocks in that language are expressed by their indentation.
   * See [wikipedia](https://en.wikipedia.org/wiki/Off-side_rule) for more information.
   * If not set, `false` is used and empty lines belong to the previous block.
   */
    offSide?: boolean;
    /**
    * Region markers used by the language.
    */
    markers?: FoldingMarkers;
}

export interface LanguageConfigurationDto {
	comments?: CommentRule;
	brackets?: CharacterPair[];
  autoClosingPairs?: Array<CharacterPair | IAutoClosingPairConditional>;
  colorizedBracketPairs?: Array<CharacterPair>;
  surroundingPairs?: Array<CharacterPair | IAutoClosingPair>;
	wordPattern?: IRegExp;
	indentationRules?: IIndentationRule;
	onEnterRules?: IOnEnterRule[];
  folding?: IndentationRuleDto;
  autoCloseBefore?: string;
}

export enum IndentAction {
	/**
	 * Insert new line and copy the previous line's indentation.
	 */
	None = 0,
	/**
	 * Insert new line and indent once (relative to the previous line's indentation).
	 */
	Indent = 1,
	/**
	 * Insert two new lines:
	 *  - the first one indented which will hold the cursor
	 *  - the second one at the same indentation level
	 */
	IndentOutdent = 2,
	/**
	 * Insert new line and outdent once (relative to the previous line's indentation).
	 */
	Outdent = 3
}

export interface LanguagesContribution {
  id: string;
  // 扩展名
  extensions: string[];
  // 语言别名
  aliases?: string[];
  // 正则表达式字符串 如 "^#!/.*\\bpython[0-9.-]*\\b"
  firstLine?: string;
  // 配置文件路径
  configuration?: string;
  // 如["text/css"]
  mimetypes?: string[];
  filenames?: string[];
  filenamePatterns?: string[];

  /**
   * 定义统一的 resolvedConfiguration 数据
   * 其中的值为 configuration 指向的 json 配置文件的内容
   * 主要解决无需多个插件即可注册多个 language 进来
   */
  resolvedConfiguration?: LanguageConfigurationDto;
}

export interface ScopeMap {
  [scopeName: string]: string;
}

export interface GrammarsContribution {
  language?: string;
  scopeName: string;
  path: string;
  location?: URI; // 通过 path 转换成 location URI
  embeddedLanguages?: ScopeMap;
  tokenTypes?: ScopeMap;
  injectTo?: string[];

  /**
   * 定义统一的 resolvedConfiguration 数据
   * 其中的值为 path 指向的 json 配置文件的内容
   * 主要解决无需多个插件即可注册多个 grammar 进来
   */
  resolvedConfiguration?: object;
}

/**
 * Describes how comments for a language work.
 */
export interface CommentRule {
  /**
   * The line comment token, like `// this is a comment`
   */
  lineComment?: string | null;
  /**
   * The block comment character pair, like `/* block comment *&#47;`
   */
  blockComment?: CharacterPair | null;
}

/**
 * A tuple of two characters, like a pair of
 * opening and closing brackets.
 */
export type CharacterPair = [string, string];

export * from './types';
