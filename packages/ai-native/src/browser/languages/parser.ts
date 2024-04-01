import Parser from 'web-tree-sitter';

import { Autowired, Injectable, Injector } from '@opensumi/di';
import * as monaco from '@opensumi/ide-monaco/lib/common';
import { Deferred } from '@opensumi/ide-utils';

import { toMonacoRange } from './tree-sitter/common';
import {
  SupportedLanguages,
  SupportedTreeSitterLanguages,
  TreeSitterLanguageFacts,
  parserNameMap,
} from './tree-sitter/language-facts';
import { IFunctionInfo } from './tree-sitter/language-facts/base';
import { WasmModuleManager } from './tree-sitter/wasm-manager';

interface CodeBlock {
  range: monaco.IRange;
  codeBlock: string;
  type: string;
}

@Injectable({ multiple: true })
export class LanguageParser {
  private parser: Parser;

  private parserLoaded = new Deferred<void>();

  @Autowired(WasmModuleManager)
  private wasmModuleManager: WasmModuleManager;

  @Autowired(TreeSitterLanguageFacts)
  private languageFacts: TreeSitterLanguageFacts;

  private constructor(private language: SupportedTreeSitterLanguages) {
    this.initializeParser();
  }

  ready() {
    return this.parserLoaded.promise;
  }

  private async initializeParser() {
    this.parser = await this.wasmModuleManager.initParser();
    // Load grammar
    const grammar = await this.wasmModuleManager.loadLanguage(this.language);
    const languageParser = await Parser.Language.load(new Uint8Array(grammar));
    // Set language
    this.parser.setLanguage(languageParser);

    this.parserLoaded.resolve();
  }

  /**
   * 从给定的位置开始，向上遍历 AST，找到最近的代码块
   * @param node 节点
   * @param position 位置
   * @returns 代码块
   */
  private findContainingCodeBlockWithPosition(node: Parser.SyntaxNode, position: number): Parser.SyntaxNode | null {
    if (node.startIndex <= position && node.endIndex >= position) {
      const isBlockIdentifier = this.languageFacts.isCodeBlock(this.language, node.type);
      if (isBlockIdentifier) {
        return node;
      }
    }

    if (node.parent) {
      return this.findContainingCodeBlockWithPosition(node.parent, position);
    }
    return null;
  }

  private findFunctionCodeBlock(node: Parser.SyntaxNode, position: number): Parser.SyntaxNode | null {
    if (node.startIndex <= position && node.endIndex >= position) {
      const valid = this.languageFacts.isFunctionCodeBlock(this.language, node.type);
      if (valid) {
        return node;
      }
    }

    if (node.parent) {
      return this.findFunctionCodeBlock(node.parent, position);
    }
    return null;
  }

  async getSyntaxNodeAsPosition(sourceCode: string, cursor: number): Promise<Parser.SyntaxNode | null> {
    await this.parserLoaded.promise;
    const tree = this.parser.parse(sourceCode);
    if (tree) {
      const rootNode = tree.rootNode;
      const cursorNode = rootNode.namedDescendantForIndex(cursor);
      return cursorNode;
    }
    return null;
  }

  async findCodeBlock(sourceCode: string, cursor: number): Promise<CodeBlock | null> {
    const cursorNode = await this.getSyntaxNodeAsPosition(sourceCode, cursor);
    if (cursorNode) {
      const selectedNode = this.findContainingCodeBlockWithPosition(cursorNode, cursor);
      if (!selectedNode) {
        return null;
      }

      return {
        codeBlock: selectedNode.text,
        range: {
          startLineNumber: selectedNode.startPosition.row + 1,
          startColumn: 0,
          endLineNumber: selectedNode.endPosition.row + 1,
          endColumn: Infinity,
        },
        type: selectedNode.type,
      };
    }

    return null;
  }

  async provideFunctionInfo(sourceCode: string, cursor: number): Promise<IFunctionInfo | null> {
    const cursorNode = await this.getSyntaxNodeAsPosition(sourceCode, cursor);
    if (!cursorNode) {
      return null;
    }
    const functionNode = this.findFunctionCodeBlock(cursorNode, cursor);

    if (!functionNode) {
      return null;
    }

    const functionInfo = this.languageFacts.provideFunctionInfo(this.language, functionNode);
    return functionInfo;
  }

  /**
   * 从给定的位置开始，找到最近的没有语法错误的代码块
   */
  async findCodeBlockWithSyntaxError(sourceCode: string, range: monaco.IRange): Promise<CodeBlock | null> {
    await this.parserLoaded.promise;
    const tree = this.parser.parse(sourceCode);
    if (tree) {
      const rootNode = tree.rootNode;
      const startPosition = {
        row: range.startLineNumber - 1,
        column: range.startColumn,
      };

      const selectedNode = rootNode.namedDescendantForPosition(startPosition);
      let parentNode = selectedNode.parent;
      if (!parentNode) {
        return {
          codeBlock: selectedNode.text,
          range: toMonacoRange(selectedNode),
          type: selectedNode.type,
        };
      }

      // 检查父节点是否有语法错误，并向上遍历
      while (parentNode) {
        // 检查当前节点是否有错误
        const hasError = parentNode.hasError;
        // 如果有错误，停止遍历，当前节点的父节点即为所求的代码块
        if (hasError) {
          break;
        }

        // 向上移动到父节点
        parentNode = parentNode.parent;
      }

      if (parentNode) {
        return {
          codeBlock: parentNode.text,
          range: toMonacoRange(parentNode),
          type: parentNode.type,
        };
      }
      return {
        codeBlock: selectedNode.text,
        range,
        type: selectedNode.type,
      };
    }
    return null;
  }
  private static pool = new Map<SupportedTreeSitterLanguages, LanguageParser>();
  static get(injector: Injector, language: SupportedTreeSitterLanguages) {
    if (!LanguageParser.pool.has(language)) {
      LanguageParser.pool.set(language, injector.get(LanguageParser, [language]));
    }

    return LanguageParser.pool.get(language);
  }
}

export const LanguageParserFactory = (injector: Injector) => (language: SupportedLanguages | string) => {
  const treeSitterLang = parserNameMap[language];
  if (treeSitterLang) {
    return LanguageParser.get(injector, treeSitterLang);
  }
};
export type LanguageParserFactory = ReturnType<typeof LanguageParserFactory>;
