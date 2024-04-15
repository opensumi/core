import { AbstractLanguageFacts } from './base';

/**
 * python 中表示代码块的节点类型
 */
export const pythonBlockCodeTypes = [
  'function_definition',
  'class_definition',
  'compound_statement',
  'if_statement',
  'elif_clause',
  'else_clause',
  'for_statement',
  'while_statement',
  'try_statement',
  'except_clause',
  'with_statement',
  'decorated_definition',
];

const blockSet = new Set(pythonBlockCodeTypes);

export class PythonLanguageFacts implements AbstractLanguageFacts {
  name = 'python' as const;
  listCommentStyle = '# ';
  blockCommentStyle = {
    start: "'''",
    end: "'''",
    linePrefix: '',
  };

  provideCodeBlocks(): Set<string> {
    return blockSet;
  }

  isCodeBlock(type: string): boolean {
    return blockSet.has(type);
  }
}
