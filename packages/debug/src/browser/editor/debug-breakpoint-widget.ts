import { Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { DebugEditor, IDebugModel } from '../../common';
import { DebugBreakpointZoneWidget } from './debug-breakpoint-zone-widget';

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

  static LINE_HEIGHT_NUMBER = 2;

  protected zone: DebugBreakpointZoneWidget;

  constructor() {
    super();
  }

  show(position: monaco.Position, model: IDebugModel) {
    this.addDispose(this.zone = new DebugBreakpointZoneWidget(this.editor, model));
    this.zone.onDispose(() => {

    });
    this.zone.show(toRange(position), DebugBreakpointWidget.LINE_HEIGHT_NUMBER);
  }
}
