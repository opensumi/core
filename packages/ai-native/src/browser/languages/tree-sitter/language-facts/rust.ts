import { AbstractLanguageFacts } from './base';

/**
 * rust 中表示代码块的节点类型
 */
export const rustBlockCodeTypes = [
  'function_item',
  'impl_item',
  'trait_item',
  'block',
  'if_expression',
  'match_expression',
  'while_expression',
  'loop_expression',
  'for_expression',
  'closure_expression',
  'struct_item',
  'enum_item',
  'union_item',
  'mod_item',
];

const blockSet = new Set(rustBlockCodeTypes);

export class RustLanguageFacts implements AbstractLanguageFacts {
  name = 'rust' as const;

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
