import { AbstractLanguageFacts } from './base';
import { typescriptBlockTypes } from './typescript';

/**
 * tsx 中表示代码块的节点类型
 * 与 typescript 中的基础节点类型一致
 */
export const typescriptreactBlockTypes = [
  ...typescriptBlockTypes,
  'jsx_element',
  'jsx_self_closing_element',
  'jsx_expression',
  'jsx_fragment',
];

const blockSet = new Set(typescriptreactBlockTypes);

export class TypeScriptReactLanguageFacts implements AbstractLanguageFacts {
  name = 'tsx' as const;
  listCommentStyle = '// ';
  blockCommentStyle = {
    start: '/**',
    end: ' */',
    linePrefix: ' * ',
  };

  provideCodeBlocks(): Set<string> {
    return blockSet;
  }

  isCodeBlock(type: string): boolean {
    return blockSet.has(type);
  }
}
