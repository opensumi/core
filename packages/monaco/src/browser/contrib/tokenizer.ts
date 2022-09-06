import { URI } from '@opensumi/ide-core-common';
import { LanguagesContribution } from '../../common';

import {
  FoldingRules,
  IAutoClosingPair,
  IAutoClosingPairConditional,
} from '../monaco-api/types';

export const ITextmateTokenizer = Symbol('ITextmateTokenizer');

export interface ITextmateTokenizerService {
  initialized: boolean;
  init(): void;
  setTheme(theme: any /** 应为 @opensumi/ide-theme#IThemeData */): void;
  unregisterGrammar(grammar: GrammarsContribution): void;
  registerGrammar(grammar: GrammarsContribution, extPath: URI): Promise<void>;
  registerLanguage(language: LanguagesContribution, extPath: URI): Promise<void>;
  registerLanguages(language: LanguagesContribution[], extPath: URI): Promise<void>;
  testTokenize(line: string, languageId: string): void;
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

export interface IndentationRules {
  increaseIndentPattern: string;
  decreaseIndentPattern: string;
  unIndentedLinePattern?: string;
  indentNextLinePattern?: string;
}

export interface ILanguageConfiguration {
  comments?: CommentRule;
  brackets?: CharacterPair[];
  autoClosingPairs?: Array<CharacterPair | IAutoClosingPairConditional>;
  surroundingPairs?: Array<CharacterPair | IAutoClosingPair>;
  wordPattern?: string | IRegExp;
  indentationRules?: IIndentationRules;
  folding?: FoldingRules;
  autoCloseBefore?: string;
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

interface IRegExp {
  pattern: string;
  flags?: string;
}

interface IIndentationRules {
  decreaseIndentPattern: string | IRegExp;
  increaseIndentPattern: string | IRegExp;
  indentNextLinePattern?: string | IRegExp;
  unIndentedLinePattern?: string | IRegExp;
}
