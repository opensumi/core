import { Disposable } from '@ali/ide-core-common';
import * as options from './debug-styles';

function lineRange(lineNumber: number) {
  return {
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    startColumn: 1,
    endColumn: Infinity,
  };
}

export enum TopStackType {
  exception,
  debugger,
}

export class DebugBreakpointWidget extends Disposable {
  private _decorations: string[];
  private _instances: Map<number, monaco.editor.IModelDeltaDecoration>;
  private _hit: Array<monaco.editor.IModelDeltaDecoration>;
  private _hover: Array<monaco.editor.IModelDeltaDecoration>;

  constructor(
    private _editor: monaco.editor.ICodeEditor,
  ) {
    super();

    this._decorations = [];
    this._hit = [];
    this._hover = [];
    this._instances = new Map();
  }

  createHoverBreakpointDecoration(lineNumber: number) {
    return {
      range: lineRange(lineNumber),
      options: options.BREAK_PONINT_HOVER_MARGIN,
    };
  }

  createAddedBreakpointDecoration(lineNumber: number) {
    return {
      range: lineRange(lineNumber),
      options: options.BREAK_PONINT_ADDED_MARGIN,
    };
  }

  createTopStackDecoraton(lineNumber: number) {
    return {
      range: lineRange(lineNumber),
      options: options.TOP_STACK_FRAME_DECORATION,
    };
  }

  createTopStackExceptionDecoration(lineNumber: number) {
    return {
      range: lineRange(lineNumber),
      options: options.TOP_STACK_FRAME_EXCEPTION_DECORATION,
    };
  }

  updateHoverPlaceholder(lineNumber: number) {
    if (!this._editor) {
      return;
    }
    const decoration = this.createHoverBreakpointDecoration(lineNumber);
    if (!this._instances.has(lineNumber)) {
      this._hover = [decoration];
    } else {
      this._hover = [];
    }
    this._takeup();
  }

  clearHoverPlaceholder() {
    if (this._instances.size > 0) {
      this._hover = [];
      this._takeup();
    }
  }

  toggleAddedPlaceholder(lineNumber: number) {
    if (!this._editor) {
      return;
    }
    const decoration = this.createAddedBreakpointDecoration(lineNumber);
    if (this._instances.has(lineNumber)) {
      this._instances.delete(lineNumber);
    } else {
      this._instances.set(lineNumber, decoration);
    }
    this._takeup();
  }

  hitBreakpointPlaceHolder(lineNumber: number, reason: TopStackType) {
    this._hit = [
      reason === TopStackType.debugger ? this.createTopStackDecoraton(lineNumber) : this.createTopStackExceptionDecoration(lineNumber),
    ];
    this._takeup();
  }

  clearHitBreakpointPlaceHolder() {
    this._hit = [];
    this._takeup();
  }

  private _mergePlaceholder() {
    return Array.from(this._instances.values())
      .concat(this._hit)
      .concat(this._hover);
  }

  private _takeup() {
    const final = this._mergePlaceholder();
    this._decorations = this._editor.deltaDecorations(this._decorations, final);
  }

  protected get placeholder(): string {
    return "Break when expression evaluates to true. 'Enter' to accept, 'esc' to cancel.";
  }
}
