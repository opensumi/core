import { Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import * as options from './debug-styles';
import { DebugEditor } from '../../common';

const lineRange = (lineNumber: number) => {
  return {
    startLineNumber: lineNumber,
    endLineNumber: lineNumber,
    startColumn: 1,
    endColumn: Infinity,
  };
};

export enum TopStackType {
  exception,
  debugger,
}

@Injectable()
export class DebugBreakpointWidget extends Disposable {
  private decorations: string[];
  private instances: Map<number, monaco.editor.IModelDeltaDecoration>;
  private hit: Array<monaco.editor.IModelDeltaDecoration>;
  private hover: Array<monaco.editor.IModelDeltaDecoration>;

  @Autowired(DebugEditor)
  editor: DebugEditor;

  constructor() {
    super();

    this.decorations = [];
    this.hit = [];
    this.hover = [];
    this.instances = new Map();
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
    if (!this.editor) {
      return;
    }
    const decoration = this.createHoverBreakpointDecoration(lineNumber);
    if (!this.instances.has(lineNumber)) {
      this.hover = [decoration];
    } else {
      this.hover = [];
    }
    this.takeup();
  }

  clearHoverPlaceholder(background: boolean = false) {
    if (this.instances.size > 0) {
      this.hover = [];
      if (!background) {
        this.takeup();
      }
    }
  }

  toggleAddedPlaceholder(lineNumber: number) {
    if (!this.editor) {
      return;
    }
    const decoration = this.createAddedBreakpointDecoration(lineNumber);
    if (this.instances.has(lineNumber)) {
      this.instances.delete(lineNumber);
    } else {
      this.instances.set(lineNumber, decoration);
    }
    this.takeup();
  }

  hitBreakpointPlaceHolder(lineNumber: number, reason: TopStackType) {
    this.hit = [
      reason === TopStackType.debugger ? this.createTopStackDecoraton(lineNumber) : this.createTopStackExceptionDecoration(lineNumber),
    ];
    this.takeup();
  }

  clearHitBreakpointPlaceHolder(background: boolean = false) {
    this.hit = [];
    if (!background) {
      this.takeup();
    }
  }

  private mergePlaceholder() {
    return Array.from(this.instances.values())
      .concat(this.hit)
      .concat(this.hover);
  }

  takeup() {
    const final = this.mergePlaceholder();
    this.decorations = this.editor.deltaDecorations(this.decorations, final);
  }

  protected get placeholder(): string {
    return "Break when expression evaluates to true. 'Enter' to accept, 'esc' to cancel.";
  }
}
