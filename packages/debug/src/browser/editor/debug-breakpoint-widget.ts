import { Disposable, Emitter } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { DebugEditor, IDebugModel } from '../../common';
import { DebugBreakpointZoneWidget, BreakpointChangeData } from './debug-breakpoint-zone-widget';

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
  static LINE_HEIGHT_NUMBER = 2;

  protected zone: DebugBreakpointZoneWidget;

  protected readonly _onDidChangeBreakpoint = new Emitter<BreakpointChangeData>();
  readonly onDidChangeBreakpoint = this._onDidChangeBreakpoint.event;

  constructor() {
    super();
  }

  show(position: monaco.Position, editor: DebugEditor, model: IDebugModel) {
    this.dispose();
    this.addDispose(this.zone = new DebugBreakpointZoneWidget(editor, model));
    this.addDispose(this.zone.onDidChangeBreakpoint((data) => {
      this._onDidChangeBreakpoint.fire(data);
    }));
    this.zone.show(toRange(position), DebugBreakpointWidget.LINE_HEIGHT_NUMBER);
  }
}
