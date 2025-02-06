import Parser from 'web-tree-sitter';

import { Autowired, Injectable } from '@opensumi/di';
import * as monaco from '@opensumi/ide-monaco/lib/common';
import { Deferred, IDisposable, LRUCache } from '@opensumi/ide-utils';

import { INearestCodeBlock, NearestCodeBlockType } from '../../common/types';

import { toMonacoRange } from './tree-sitter/common';
import { SupportedTreeSitterLanguages, TreeSitterLanguageFacts } from './tree-sitter/language-facts';
import { ICodeBlockInfo, IOtherBlockInfo } from './tree-sitter/language-facts/base';
import { WasmModuleManager } from './tree-sitter/wasm-manager';

export const DEFAULT_MIN_BLOCK_COUNT = 20;

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

  public getParser(): Parser {
    return this.parser;
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
  async findCodeBlockWithoutSyntaxError(sourceCode: string, range: monaco.IRange): Promise<IOtherBlockInfo | null> {
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

  async trimSuffixSyntaxErrors(code: string, minBlockCount = DEFAULT_MIN_BLOCK_COUNT): Promise<string> {
    await this.parserLoaded.promise;
    const tree = this.parser?.parse(code);
    const rootNode = tree?.rootNode;
    if (!rootNode) {
      return code;
    }
    const { namedChildren } = rootNode;

    if (!rootNode.hasError || namedChildren.length <= minBlockCount) {
      return this.trimToLastCompleteBlock(rootNode, true);
    }

    let lastErrorNode: Parser.SyntaxNode | null = null;
    let targetNode: Parser.SyntaxNode | null = null;
    for (let i = namedChildren.length - 1; i >= minBlockCount; i--) {
      const child = namedChildren[i];
      if (child.hasError && i !== 0) {
        lastErrorNode = child;
      } else if (lastErrorNode) {
        targetNode = child;
        break;
      }
    }

    if (!targetNode) {
      targetNode = namedChildren[minBlockCount - 1];
    }

    const lines = code.split('\n');
    const remainingLines = lines.slice(0, targetNode.endPosition.row + 1);
    const lastLine = remainingLines[remainingLines.length - 1].slice(0, targetNode.endPosition.column);
    const correctCode = `${remainingLines.length > 1 ? `${remainingLines.slice(0, -1).join('\n')}\n` : ''}${lastLine}`;
    return correctCode;
  }

  async trimPrefixSyntaxErrors(code: string, minBlockCount = DEFAULT_MIN_BLOCK_COUNT): Promise<string> {
    await this.parserLoaded.promise;
    const tree = this.parser?.parse(code);
    const rootNode = tree?.rootNode;
    if (!rootNode) {
      return code;
    }
    const { namedChildren } = rootNode;

    if (!rootNode.hasError || namedChildren.length <= minBlockCount) {
      return this.trimToLastCompleteBlock(rootNode);
    }

    let firstErrorNode: Parser.SyntaxNode | null = null;
    let targetNode: Parser.SyntaxNode | null = null;
    for (let i = 0; i < namedChildren.length - minBlockCount; i++) {
      const child = namedChildren[i];
      if (child.hasError && i !== namedChildren.length - 1) {
        firstErrorNode = child;
      } else if (firstErrorNode) {
        targetNode = child;
        break;
      }
    }

    if (!targetNode) {
      targetNode = namedChildren[namedChildren.length - minBlockCount];
    }

    const lines = code.split('\n');
    const remainingLines = lines.slice(targetNode.startPosition.row);
    const firstLine = remainingLines[0].slice(targetNode.startPosition.column);
    const correctCode = `${firstLine}${remainingLines.length > 1 ? `\n${remainingLines.slice(1).join('\n')}` : ''}`;
    return correctCode;
  }

  trimToLastCompleteBlock(rootNode: Parser.SyntaxNode, reverse = false) {
    const { namedChildren } = rootNode;
    if (reverse) {
      const lastNamedChild = namedChildren[namedChildren.length - 2];
      if (lastNamedChild) {
        const lines = rootNode.text.split('\n');
        const remainingLines = lines.slice(0, lastNamedChild.endPosition.row + 1);
        const lastLine = remainingLines[remainingLines.length - 1].slice(0, lastNamedChild.endPosition.column);
        const correctCode = `${
          remainingLines.length > 1 ? `${remainingLines.slice(0, -1).join('\n')}\n` : ''
        }${lastLine}`;
        return correctCode;
      }
    } else {
      const firstNamedChild = namedChildren[1];
      if (firstNamedChild) {
        const lines = rootNode.text.split('\n');
        const remainingLines = lines.slice(firstNamedChild.startPosition.row);
        const firstLine = remainingLines[0].slice(firstNamedChild.startPosition.column);
        const correctCode = `${firstLine}${remainingLines.length > 1 ? `\n${remainingLines.slice(1).join('\n')}` : ''}`;
        return correctCode;
      }
    }
    return rootNode.text;
  }

  private findTypeIdentifier(node: Parser.SyntaxNode) {
    let next: Parser.SyntaxNode = node;
    while (next) {
      if (next.type === 'type_identifier') {
        return next.text;
      }
      const nextNode = next.child(1);
      if (!nextNode) {
        break;
      }
      next = nextNode;
    }
    return '';
  }

  async extractImportPaths(code: string) {
    const paths: string[] = [];
    const tree = await this.parser.parse(code);
    const rootNode = tree?.rootNode;
    const importLines: Parser.SyntaxNode[] = [];
    const types: string[] = [];
    if (rootNode) {
      for (let i = 0; i < rootNode?.childCount; i++) {
        const sourceChild = rootNode.child(i);
        if (sourceChild?.type === 'import_statement') {
          importLines.push(sourceChild);
        } else if (sourceChild?.type === 'type_annotation') {
          const node = sourceChild.child(1);
          if (node) {
            types.push(node.text);
          }
        } else if (sourceChild?.type === 'lexical_declaration') {
          const type = this.findTypeIdentifier(sourceChild);
          if (type) {
            types.push(type);
          }
        }
      }
    }
    for (const line of importLines) {
      if (types.some((type) => line.text.includes(type))) {
        let importPath = line.child(3)?.text;
        if (importPath?.includes("'") || importPath?.includes('"')) {
          importPath = importPath.slice(1, -1);
        }
        if (importPath) {
          paths.push(importPath);
        }
      }
    }
    return paths;
  }

  async extractInterfaceOrTypeCode(code: string) {
    const snippets: string[] = [];
    if (this.language === 'typescript') {
      await this.parserLoaded.promise;
      const tree = this.parser?.parse(code);
      const rootNode = tree?.rootNode;
      if (rootNode) {
        for (let i = 0; i < rootNode?.childCount; i++) {
          const sourceChild = rootNode.child(i);
          if (sourceChild?.type === 'export_statement') {
            const exportChild = sourceChild.child(1);
            if (exportChild?.type === 'interface_declaration' || exportChild?.type === 'type_alias_declaration') {
              snippets.push(exportChild.text);
            }
          } else if (sourceChild?.type === 'interface_declaration' || sourceChild?.type === 'type_alias_declaration') {
            snippets.push(sourceChild.text);
          }
        }
      }
    }
    return snippets;
  }

  async findSyntaxErrorCount(code: string): Promise<number> {
    await this.parserLoaded.promise;
    const tree = this.parser?.parse(code);
    const rootNode = tree?.rootNode;

    if (!rootNode) {
      return 0;
    }

    let errorCount = 0;

    const countErrors = (node: Parser.SyntaxNode) => {
      // 仅检查特定类型的节点，例如函数声明
      const isLargeSyntaxBlock =
        node.type === 'function_declaration' ||
        node.type === 'class_declaration' ||
        node.type === 'variable_declarator' ||
        node.type === 'statement_block' ||
        node.type === 'expression_statement';
      if (isLargeSyntaxBlock && (node.hasError || node.isMissing || node.type === 'ERROR')) {
        errorCount++;
      }
      // 递归检查子节点
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child) {
          countErrors(child);
        }
      }
    };

    countErrors(rootNode); // 从根节点开始检查错误

    return errorCount;
  }

  async findNearestCodeBlockWithPosition(code: string, cursor: number): Promise<INearestCodeBlock | null> {
    const tree = await this.parser.parse(code);
    if (tree) {
      const { rootNode } = tree;
      const cursorNode = rootNode.namedDescendantForIndex(cursor);
      const selectedNode = this.findContainingCodeBlockWithPosition(cursorNode, cursor);
      if (!selectedNode) {
        return null;
      }

      const lines = code.split('\n');
      let offset = lines.slice(0, selectedNode.startPosition.row).reduce((acc, cur) => acc + cur.length, 0);
      offset += selectedNode.startPosition.row;
      offset += selectedNode.startPosition.column;

      return {
        codeBlock: selectedNode.text,
        range: {
          start: {
            line: selectedNode.startPosition.row,
            character: 0,
          },
          end: {
            line: selectedNode.endPosition.row,
            character: Infinity,
          },
        },
        offset,
        type:
          selectedNode.startPosition.row === selectedNode.endPosition.row
            ? NearestCodeBlockType.Line
            : NearestCodeBlockType.Block,
      };
    }
    return null;
  }

  dispose() {
    this.parser.delete();
    this.lruCache.clear();
  }
}
