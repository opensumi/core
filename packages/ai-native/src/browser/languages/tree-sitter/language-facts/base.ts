import Parser from 'web-tree-sitter';

import { IRange } from '@opensumi/ide-core-common';

import { SupportedTreeSitterLanguages } from './types';

export interface IFunctionInfo {
  name: string;
  signatures: string[];
  range: IRange;
}

interface IBlockCommentStyle {
  start: string;
  end: string;
  linePrefix: string;
}

export abstract class AbstractLanguageFacts {
  abstract name: SupportedTreeSitterLanguages;

  abstract listCommentStyle: string;
  abstract blockCommentStyle: IBlockCommentStyle;

  abstract provideFunctionInfo?(node: Parser.SyntaxNode): IFunctionInfo | null;
  abstract provideCodeBlocks(): Set<string>;
  abstract provideFunctionCodeBlocks?(): Set<string>;
}

export type AbstractLanguageFactsDerived = (new () => AbstractLanguageFacts) & typeof AbstractLanguageFacts;
