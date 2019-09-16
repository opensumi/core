import { Disposable } from '@ali/ide-core-common';

export class DebugHoverWidget extends Disposable {
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
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: 1,
        endColumn: 1,
      },
      options: {
        glyphMarginClassName: 'debug-glyph-hover',
        isWholeLine: true,
      },
    };
  }

  createAddedBreakpointDecoration(lineNumber: number) {
    return {
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: 1,
        endColumn: 1,
      },
      options: {
        glyphMarginClassName: 'debug-glyph-added',
        isWholeLine: true,
      },
    };
  }

  createLineHighlightDecoraton(lineNumber: number) {
    return {
      range: {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn: 1,
        endColumn: Infinity,
      },
      options: {
        className: 'debug-glyph-highlight',
        isWholeLine: true,
      },
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
      this._hit = [];
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

  hitBreakpointPlaceHolder(lineNumber: number) {
    this._hit = [this.createLineHighlightDecoraton(lineNumber)];
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
