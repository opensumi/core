import { AbstractLanguageFacts } from './base';

/**
 * java 中表示代码块的节点类型
 */
const javaBlockCodeTypes = [
  'compilation_unit',
  'class_declaration',
  'interface_declaration',
  'enum_declaration',
  'method_declaration',
  'constructor_declaration',
  'block',
  'static_initializer',
  'instance_initializer',
  'if_statement',
  'switch_statement',
  'while_statement',
  'do_statement',
  'for_statement',
  'enhanced_for_statement',
  'try_statement',
  'catch_clause',
  'finally_clause',
];

const functionCodeBlocks = new Set(['method_declaration', 'constructor_declaration']);

const blockSet = new Set(javaBlockCodeTypes);

export class JavaLanguageFacts implements AbstractLanguageFacts {
  name = 'java' as const;
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

  isFunctionCodeBlocks(type: string): boolean {
    return functionCodeBlocks.has(type);
  }
}
