export * from '@ali/ide-core-browser/lib/monaco';

export interface LanguagesContribution {
  id: string;
  extensions: string[];
  aliases?: string[];
  filenames?: string[];
  // 正则表达式字符串 如 "^#!/.*\\bpython[0-9.-]*\\b"
  firstLine?: string;
  // 配置文件路径
  configuration?: string;
  // 如["text/css"]
  mimetypes?: string[];
  filenamePatterns?: string[];
}

export interface ScopeMap {
  [scopeName: string]: string;
}

export interface GrammarsContribution {
  format: 'json' | 'plist';
  language?: string;
  scopeName: string;
  path?: string;
  grammar?: string | object;
  embeddedLanguages?: ScopeMap;
  tokenTypes?: ScopeMap;
  injectTo?: string[];
}

// TODO 这些声明最后都要聚拢到插件声明
export interface FoldingMarkers {
  start: string;
  end: string;
}

export interface FoldingRules {
  offSide?: boolean;
  markers?: FoldingMarkers;
}

export interface IndentationRules {
  increaseIndentPattern: string;
  decreaseIndentPattern: string;
  unIndentedLinePattern?: string;
  indentNextLinePattern?: string;
}
