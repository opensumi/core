import { AbstractLanguageFacts } from './base';

/**
 * typescript 中表示代码块的节点类型
 */
export const typescriptBlockTypes = [
  'function',
  'function_declaration',
  'function_expression',
  'arrow_function',
  'class_declaration',
  'interface_declaration',
  'method_definition',
  'method_signature',
  'enum_declaration',
  'type_alias_declaration',
  'lexical_declaration',
  'if_statement',
  'switch_case',
  'while_statement',
  'do_statement',
  'for_statement',
  'for_in_statement',
  'for_of_statement',
  'try_statement',
  'catch_clause',
  'block',
  'module',
  'public_field_definition',
  'private_field_definition',
  'export_statement',
];

const blockSet = new Set(typescriptBlockTypes);

export class TypeScriptLanguageFacts implements AbstractLanguageFacts {
  name = 'typescript' as const;
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
