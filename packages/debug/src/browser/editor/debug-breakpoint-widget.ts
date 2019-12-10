import { Disposable, Emitter } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { DebugEditor, IDebugModel } from '../../common';
import { DebugBreakpointZoneWidget, BreakpointChangeData, DebugBreakpointWidgetContext } from './debug-breakpoint-zone-widget';
import { BreakpointWidgetInputFocus } from '../contextkeys';

export function toRange(position: monaco.IPosition | number): monaco.IRange {
  if (typeof position === 'number') {
    return {
      startLineNumber: position,
      endLineNumber: position,
      startColumn: 1,
      endColumn: 1,
    };
  } else {
    const { lineNumber }  = position;
    return {
      startLineNumber: lineNumber,
      endLineNumber: lineNumber,
      startColumn: 1,
      endColumn: 1,
    };
  }
}

export enum TopStackType {
  exception,
  debugger,
}

@Injectable()
export class DebugBreakpointWidget extends Disposable {

  @Autowired(DebugEditor)
  private readonly editor: DebugEditor;

  @Autowired(BreakpointWidgetInputFocus)
  private readonly breakpointWidgetInputFocus: BreakpointWidgetInputFocus;

  static LINE_HEIGHT_NUMBER = 2;

  protected zone: DebugBreakpointZoneWidget;

  private _position: monaco.Position | undefined;

  protected readonly _onDidChangeBreakpoint = new Emitter<BreakpointChangeData>();
  readonly onDidChangeBreakpoint = this._onDidChangeBreakpoint.event;

  constructor() {
    super();
  }

  get position() {
    return this._position;
  }

  get values() {
    return this.zone.values;
  }

  show(position: monaco.Position, context?: DebugBreakpointWidgetContext) {
    this.dispose();
    this._position = position;
    this.addDispose(this.zone = new DebugBreakpointZoneWidget(this.editor, context));
    this.addDispose(this.zone.onDidChangeBreakpoint((data) => {
      this._onDidChangeBreakpoint.fire(data);
    }));
    this.addDispose(this.zone.onFocus(() => {
      this.breakpointWidgetInputFocus.set(true);
    }));
    this.addDispose(this.zone.onBlur(() => {
      this.breakpointWidgetInputFocus.set(false);
    }));
    this.addDispose(this.zone.onDispose(() => {
      this._position = undefined;
      this.breakpointWidgetInputFocus.set(false);
    }));
    this.zone.show(toRange(position), DebugBreakpointWidget.LINE_HEIGHT_NUMBER);
  }

  hide() {
    this.zone.dispose();
  }
}
