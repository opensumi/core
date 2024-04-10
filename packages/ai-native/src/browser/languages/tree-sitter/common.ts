import Parser from 'web-tree-sitter';

/**
 * monaco editor 是 zero base，line 需要 + 1
 */
export function toMonacoRange(node: Parser.SyntaxNode) {
  return {
    startLineNumber: node.startPosition.row + 1,
    startColumn: node.startPosition.column + 1,
    endLineNumber: node.endPosition.row + 1,
    endColumn: node.endPosition.column + 1,
  };
}
