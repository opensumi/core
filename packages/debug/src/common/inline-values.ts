import { IRange, CancellationToken, Event } from '@opensumi/ide-core-common';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import { ITextModel } from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';

// Inline Values
/**
 * A value-object that contains contextual information when requesting inline values from a InlineValuesProvider.
 * @internal
 */
export interface InlineValueContext {
  frameId: number;
  stoppedLocation: Range;
}

/**
 * Provide inline value as text.
 * @internal
 */
export interface InlineValueText {
  type: 'text';
  range: IRange;
  text: string;
}

/**
 * Provide inline value through a variable lookup.
 * @internal
 */
export interface InlineValueVariableLookup {
  type: 'variable';
  range: IRange;
  variableName?: string;
  caseSensitiveLookup: boolean;
}

/**
 * Provide inline value through an expression evaluation.
 * @internal
 */
export interface InlineValueExpression {
  type: 'expression';
  range: IRange;
  expression?: string;
}

/**
 * Inline value information can be provided by different means:
 * - directly as a text value (class InlineValueText).
 * - as a name to use for a variable lookup (class InlineValueVariableLookup)
 * - as an evaluatable expression (class InlineValueEvaluatableExpression)
 * The InlineValue types combines all inline value types into one type.
 * @internal
 */
export type InlineValue = InlineValueText | InlineValueVariableLookup | InlineValueExpression;

/**
 * The inline values provider interface defines the contract between extensions and
 * the debugger's inline values feature.
 * @internal
 */
export interface InlineValuesProvider {
  /**
   */
  onDidChangeInlineValues?: Event<void> | undefined;
  /**
   * Provide the "inline values" for the given range and document. Multiple hovers at the same
   * position will be merged by the editor. A hover can have a range which defaults
   * to the word range at the position when omitted.
   */
  provideInlineValues(
    model: ITextModel,
    viewPort: Range,
    context: InlineValueContext,
    token: CancellationToken,
  ): Thenable<InlineValue[]>;
}
// End Inline Values
