import { Disposable } from '@ali/ide-core-common';

export class DebugHoverWidget extends Disposable {
  private _decorations: string[];
  private _instances: Map<number, monaco.editor.IModelDeltaDecoration>;

  constructor(
    private _editor: monaco.editor.ICodeEditor,
  ) {
    super();

    this._decorations = [];
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
        linesDecorationsClassName: 'debug-glyph-hover',
        isWholeLine: true,
      },
    };
  }

  createAddedBreakpointDecoration(lineNumber) {
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

  updateHoverPlaceholder(lineNumber: number) {
    if (!this._editor) {
      return;
    }
    const decoration = this.createHoverBreakpointDecoration(lineNumber);
    if (!this._instances.has(lineNumber)) {
      this._decorations = this._editor.deltaDecorations(this._decorations,
        Array.from(this._instances.values()).concat([decoration]));
    } else {
      this._decorations = this._editor.deltaDecorations(this._decorations,
        Array.from(this._instances.values()));
    }
  }

  clearHoverPlaceholder() {
    if (this._instances.size > 0) {
      this._decorations = this._editor.deltaDecorations(this._decorations,
        Array.from(this._instances.values()));
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
    this._decorations = this._editor.deltaDecorations(this._decorations,
      Array.from(this._instances.values()));
  }

  protected get placeholder(): string {
    return "Break when expression evaluates to true. 'Enter' to accept, 'esc' to cancel.";
  }
}
