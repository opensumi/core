import { Injectable } from '@ali/common-di';

/**
 * TODO: 向LSP引入新请求以查找表达式范围: https://github.com/Microsoft/language-server-protocol/issues/462
 */
@Injectable()
export class DebugExpressionProvider {
  get(model: monaco.editor.IModel, selection: monaco.IRange): string {
    const lineContent = model.getLineContent(selection.startLineNumber);
    const { start, end } = this.getExactExpressionStartAndEnd(lineContent, selection.startColumn, selection.endColumn);
    return lineContent.substring(start - 1, end);
  }
  protected getExactExpressionStartAndEnd(lineContent: string, looseStart: number, looseEnd: number): { start: number, end: number } {
    let matchingExpression: string | undefined;
    let startOffset = 0;

    // Some example supported expressions: myVar.prop, a.b.c.d, myVar?.prop, myVar->prop, MyClass::StaticProp, *myVar
    // Match any character except a set of characters which often break interesting sub-expressions
    const expression = /([^()\[\]{}<>\s+\-/%~#^;=|,`!]|\->)+/g;
    // tslint:disable-next-line
    let result: RegExpExecArray | null = null;

    // First find the full expression under the cursor
    while (result = expression.exec(lineContent)) {
      const start = result.index + 1;
      const end = start + result[0].length;

      if (start <= looseStart && end >= looseEnd) {
        matchingExpression = result[0];
        startOffset = start;
        break;
      }
    }

    // If there are non-word characters after the cursor, we want to truncate the expression then.
    // For example in expression 'a.b.c.d', if the focus was under 'b', 'a.b' would be evaluated.
    if (matchingExpression) {
      const subExpression: RegExp = /\w+/g;
      // tslint:disable-next-line
      let subExpressionResult: RegExpExecArray | null = null;
      while (subExpressionResult = subExpression.exec(matchingExpression)) {
        const subEnd = subExpressionResult.index + 1 + startOffset + subExpressionResult[0].length;
        if (subEnd >= looseEnd) {
          break;
        }
      }

      if (subExpressionResult) {
        matchingExpression = matchingExpression.substring(0, subExpression.lastIndex);
      }
    }

    return matchingExpression ?
      { start: startOffset, end: startOffset + matchingExpression.length - 1 } :
      { start: 0, end: 0 };
  }
}
