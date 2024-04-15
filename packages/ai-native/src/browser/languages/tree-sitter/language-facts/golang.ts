import { AbstractLanguageFacts } from './base';

/**
 * go 中表示代码块的节点类型
 */
const goLangBlockCodeTypes = [
  'function_declaration',
  'method_declaration',
  'block',
  'if_statement',
  'else_statement',
  'switch_statement',
  'case_clause',
  'for_statement',
  'range_clause',
  'type_switch_statement',
  'type_case_clause',
  'comm_clause',
  'select_statement',
  'go_statement',
  'defer_statement',
];

const blockSet = new Set(goLangBlockCodeTypes);

export class GolangLanguageFacts implements AbstractLanguageFacts {
  name = 'go' as const;
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
