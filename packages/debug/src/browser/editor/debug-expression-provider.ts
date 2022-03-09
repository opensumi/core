import { Injectable, Autowired } from '@opensumi/di';
import { CancellationTokenSource, coalesce, IRange } from '@opensumi/ide-core-common';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IEvaluatableExpressionService } from './evaluatable-expression';


@Injectable()
export class DebugExpressionProvider {
  @Autowired(IEvaluatableExpressionService)
  protected readonly evaluatableExpressionService: IEvaluatableExpressionService;

  async get(model: ITextModel, selection: monaco.IRange): Promise<string | undefined> {
    let matchingExpression: string | undefined;
    let rng: IRange | undefined;

    if (this.evaluatableExpressionService.hasEvaluatableExpressProvider(model)) {
      const cancellationSource = new CancellationTokenSource();
      const supports = this.evaluatableExpressionService.getSupportedEvaluatableExpressionProvider(model);

      const pos = new monaco.Position(selection.startLineNumber, selection.startColumn);

      const promises = supports.map((support) =>
        Promise.resolve(support.provideEvaluatableExpression(model, pos, cancellationSource.token)).then(
          (expression) => expression,
          () => undefined,
        ),
      );

      const results = await Promise.all(promises).then(coalesce);
      if (results.length > 0) {
        matchingExpression = results[0].expression;
        rng = results[0].range;

        if (!matchingExpression) {
          const lineContent = model.getLineContent(pos.lineNumber);
          matchingExpression = lineContent.substring(rng.startColumn - 1, rng.endColumn - 1);
        }
      }
    } else {
      const lineContent = model.getLineContent(selection.startLineNumber);
      const { start, end } = this.getExactExpressionStartAndEnd(
        lineContent,
        selection.startColumn,
        selection.endColumn,
      );

      matchingExpression = lineContent.substring(start - 1, end);
    }

    return matchingExpression;
  }

  protected getExactExpressionStartAndEnd(
    lineContent: string,
    looseStart: number,
    looseEnd: number,
  ): { start: number; end: number } {
    let matchingExpression: string | undefined;
    let startOffset = 0;

    // Some example supported expressions: myVar.prop, a.b.c.d, myVar?.prop, myVar->prop, MyClass::StaticProp, *myVar
    // Match any character except a set of characters which often break interesting sub-expressions
    const expression = /([^()[\]{}<>\s+\-/%~#^;=|,`!]|->)+/g;
    let result: RegExpExecArray | null = null;

    // First find the full expression under the cursor
    while ((result = expression.exec(lineContent))) {
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
      const subExpression = /\w+/g;
      let subExpressionResult: RegExpExecArray | null = null;
      while ((subExpressionResult = subExpression.exec(matchingExpression))) {
        const subEnd = subExpressionResult.index + 1 + startOffset + subExpressionResult[0].length;
        if (subEnd >= looseEnd) {
          break;
        }
      }

      if (subExpressionResult) {
        matchingExpression = matchingExpression.substring(0, subExpression.lastIndex);
      }
    }
    return matchingExpression
      ? { start: startOffset, end: startOffset + matchingExpression.length - 1 }
      : { start: 0, end: 0 };
  }
}
