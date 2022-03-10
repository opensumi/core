import { CancellationToken } from '@opensumi/ide-core-common';
import { IRange, Position } from '@opensumi/ide-core-common/lib/types';
import type { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

/**
 * An evaluatable expression represents additional information for an expression in a document. Evaluatable expressions are
 * evaluated by a debugger or runtime and their result is rendered in a tooltip-like widget.
 * @internal
 */
export interface IEvaluatableExpression {
  /**
   * The range to which this expression applies.
   */
  range: IRange;
  /**
   * This expression overrides the expression extracted from the range.
   */
  expression?: string;
}

/**
 * The evaluatable expression provider interface defines the contract between extensions and
 * the debug hover. In this contract the provider returns an evaluatable expression for a given position
 * in a document and VS Code evaluates this expression in the active debug session and shows the result in a debug hover.
 */
export interface EvaluatableExpressionProvider {
  /**
   * Provide an evaluatable expression for the given document and position.
   * VS Code will evaluate this expression in the active debug session and will show the result in the debug hover.
   * The expression can be implicitly specified by the range in the underlying document or by explicitly returning an expression.
   *
   * @param document The document for which the debug hover is about to appear.
   * @param position The line and character position in the document where the debug hover is about to appear.
   * @param token A cancellation token.
   * @return An EvaluatableExpression or a thenable that resolves to such. The lack of a result can be
   * signaled by returning `undefined` or `null`.
   */
  provideEvaluatableExpression(
    document: ITextModel,
    position: Position,
    token: CancellationToken,
  ): PromiseLike<IEvaluatableExpression | undefined>;
}
