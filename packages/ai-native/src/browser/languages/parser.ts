import Parser from 'web-tree-sitter';

import { Autowired, Injectable } from '@opensumi/di';
import * as monaco from '@opensumi/ide-monaco/lib/common';
import { Deferred, IDisposable, LRUCache } from '@opensumi/ide-utils';

import { toMonacoRange } from './tree-sitter/common';
import { SupportedTreeSitterLanguages, TreeSitterLanguageFacts } from './tree-sitter/language-facts';
import { ICodeBlockInfo, IOtherBlockInfo } from './tree-sitter/language-facts/base';
import { WasmModuleManager } from './tree-sitter/wasm-manager';

@Injectable({ multiple: true })
export class LanguageParser implements IDisposable {
  private parser: Parser;

  private parserLoaded = new Deferred<void>();

  private lruCache = new LRUCache<string, Parser.SyntaxNode>(500);

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

  async parseAST(model: monaco.ITextModel) {
    const key = `${model.id}@${model.getVersionId()}`;
    const cachedNode = this.lruCache.get(key);
    if (cachedNode) {
      return cachedNode;
    }

    await this.parserLoaded.promise;
    const sourceCode = model.getValue();
    const tree = this.parser.parse(sourceCode);
    if (tree) {
      const rootNode = tree.rootNode;
      this.lruCache.set(key, rootNode);
      return rootNode;
    }
  }

  async getSyntaxNodeAsPosition(model: monaco.ITextModel, cursor: number): Promise<Parser.SyntaxNode | null> {
    const rootNode = await this.parseAST(model);
    if (rootNode) {
      const cursorNode = rootNode.namedDescendantForIndex(cursor);
      return cursorNode;
    }
    return null;
  }

  /**
   * 从给定的位置开始，找到最近的没有语法错误的代码块
   */
  async findCodeBlockWithSyntaxError(sourceCode: string, range: monaco.IRange): Promise<IOtherBlockInfo | null> {
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
          range: toMonacoRange(selectedNode),
          type: selectedNode.type,
          infoCategory: 'other',
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
          range: toMonacoRange(parentNode),
          type: parentNode.type,
          infoCategory: 'other',
        };
      }
      return {
        range,
        type: selectedNode.type,
        infoCategory: 'other',
      };
    }
    return null;
  }

  async provideCodeBlockInfo(model: monaco.ITextModel, position: monaco.Position): Promise<ICodeBlockInfo | null> {
    const cursor = model.getOffsetAt(position);

    const cursorNode = await this.getSyntaxNodeAsPosition(model, cursor);
    if (!cursorNode) {
      return null;
    }

    const functionNode = this.findFunctionCodeBlock(cursorNode, cursor);
    if (functionNode) {
      return this.languageFacts.provideFunctionInfo(this.language, functionNode);
    }

    const selectedNode = this.findContainingCodeBlockWithPosition(cursorNode, cursor);
    if (selectedNode) {
      return {
        infoCategory: 'other',
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

  async provideCodeBlockInfoInRange(model: monaco.ITextModel, range: monaco.IRange): Promise<ICodeBlockInfo | null> {
    const rootNode = await this.parseAST(model);
    if (rootNode) {
      const startPosition = {
        row: range.startLineNumber - 1,
        column: range.startColumn - 1,
      };
      const endPosition = {
        row: range.endLineNumber,
        column: range.endColumn,
      };

      const types = this.languageFacts.getCodeBlockTypes(this.language);
      if (!types || types.size === 0) {
        return null;
      }

      const nodes = rootNode.descendantsOfType(Array.from(types), startPosition, endPosition);
      if (nodes && nodes.length > 0) {
        const firstNode = nodes[0];
        const range = toMonacoRange(firstNode);
        return {
          infoCategory: 'other',
          range,
          type: firstNode.type,
        };
      }
    }

    return null;
  }

  dispose() {
    this.parser.delete();
    this.lruCache.clear();
  }
}
