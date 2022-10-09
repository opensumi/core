import { URI } from '@opensumi/ide-core-common';

import { LanguagesContribution } from '../../common';

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
  balancedBracketScopes?: string[];
  unbalancedBracketScopes?: string[];

  /**
   * 定义统一的 resolvedConfiguration 数据
   * 其中的值为 path 指向的 json 配置文件的内容
   * 主要解决无需多个插件即可注册多个 grammar 进来
   */
  resolvedConfiguration?: object;
}
