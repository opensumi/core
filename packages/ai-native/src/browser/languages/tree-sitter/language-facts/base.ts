import Parser from 'web-tree-sitter';

import { IRange } from '@opensumi/ide-core-common';

import { SupportedTreeSitterLanguages } from './types';

interface IBaseCodeBlockInfo {
  infoCategory: string;
  type: string;
  range: IRange;
}

export interface IFunctionBlockInfo extends IBaseCodeBlockInfo {
  infoCategory: 'function';

  name: string;
  signatures: string[];
}

export interface IOtherBlockInfo extends IBaseCodeBlockInfo {
  infoCategory: 'other';
}

interface IBlockCommentStyle {
  start: string;
  end: string;
  linePrefix: string;
}

export type ICodeBlockInfo = IFunctionBlockInfo | IOtherBlockInfo;

export abstract class AbstractLanguageFacts {
  abstract name: SupportedTreeSitterLanguages;

  abstract listCommentStyle: string;
  abstract blockCommentStyle: IBlockCommentStyle;

  abstract provideFunctionInfo?(node: Parser.SyntaxNode): IFunctionBlockInfo | null;
  abstract provideCodeBlocks(): Set<string>;
  abstract isCodeBlock(type: string): boolean;
  abstract isFunctionCodeBlocks?(type: string): boolean;
}

export type AbstractLanguageFactsDerived = (new () => AbstractLanguageFacts) & typeof AbstractLanguageFacts;
