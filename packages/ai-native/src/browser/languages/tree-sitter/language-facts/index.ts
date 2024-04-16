// 所有已支持语言中代码块的 AST 节点类型

export * from './types';
import Parser from 'web-tree-sitter';

import { Injectable } from '@opensumi/di';

import { AbstractLanguageFacts, AbstractLanguageFactsDerived, IFunctionBlockInfo } from './base';
import { GolangLanguageFacts } from './golang';
import { JavaLanguageFacts } from './java';
import { JavaScriptLanguageFacts } from './javascript';
import { JavaScriptReactLanguageFacts } from './javascriptreact';
import { PythonLanguageFacts } from './python';
import { RustLanguageFacts } from './rust';
import { SupportedTreeSitterLanguages } from './types';
import { TypeScriptLanguageFacts } from './typescript';
import { TypeScriptReactLanguageFacts } from './typescriptreact';

const emptySet = new Set<string>();

export const knownLanguageFacts = [
  GolangLanguageFacts,
  JavaLanguageFacts,
  JavaScriptLanguageFacts,
  JavaScriptReactLanguageFacts,
  PythonLanguageFacts,
  RustLanguageFacts,
  TypeScriptLanguageFacts,
  TypeScriptReactLanguageFacts,
] as AbstractLanguageFactsDerived[];

@Injectable()
export class TreeSitterLanguageFacts {
  protected langs = new Map<SupportedTreeSitterLanguages, AbstractLanguageFacts>();
  constructor() {
    knownLanguageFacts.forEach((Fact) => {
      const fact = new Fact();
      this.langs.set(fact.name, fact);
    });
  }

  isCodeBlock(language: SupportedTreeSitterLanguages, type: string): boolean {
    const languageFacts = this.langs.get(language);
    if (languageFacts && languageFacts.isCodeBlock) {
      return languageFacts.isCodeBlock(type);
    }
    return false;
  }

  isFunctionCodeBlock(language: SupportedTreeSitterLanguages, type: string): boolean {
    const languageFacts = this.langs.get(language);
    if (languageFacts && languageFacts.isFunctionCodeBlocks) {
      return languageFacts.isFunctionCodeBlocks(type);
    }
    return false;
  }

  provideFunctionInfo(language: SupportedTreeSitterLanguages, node: Parser.SyntaxNode): IFunctionBlockInfo | null {
    const languageFacts = this.langs.get(language);
    if (languageFacts && languageFacts.provideFunctionInfo) {
      return languageFacts.provideFunctionInfo(node);
    }
    return null;
  }

  getCodeBlockTypes(language: SupportedTreeSitterLanguages): Set<string> {
    const languageFacts = this.langs.get(language);
    if (languageFacts) {
      return languageFacts.provideCodeBlocks();
    }
    return emptySet;
  }
}
