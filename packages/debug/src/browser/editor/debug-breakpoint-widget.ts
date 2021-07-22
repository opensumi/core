import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { Disposable, positionToRange } from '@ali/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { DebugEditor } from '../../common';
import { DebugBreakpointZoneWidget, DebugBreakpointWidgetContext } from './debug-breakpoint-zone-widget';
import { BreakpointWidgetInputFocus } from '../contextkeys';
import { DebugBreakpointsService } from '../view/breakpoints/debug-breakpoints.service';

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

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  static LINE_HEIGHT_NUMBER = 2;

  protected zone: DebugBreakpointZoneWidget;

  private _position: monaco.Position | undefined;

  constructor() {
    super();
  }

  get position() {
    return this._position;
  }

  get values() {
    return this.zone?.values;
  }

  get breakpointType(): DebugBreakpointZoneWidget.Context {
    return this.zone?.breakpointType;
  }

  show(position: monaco.Position, contexts?: DebugBreakpointWidgetContext, defaultContext: DebugBreakpointZoneWidget.Context = 'condition') {
    this.dispose();
    this._position = position;
    this.addDispose(this.zone = this.injector.get(DebugBreakpointZoneWidget, [this.editor, { ...contexts }, defaultContext]));
    this.addDispose(this.zone.onDidChangeBreakpoint(({ context, value }) => {
      if (contexts) {
        contexts[context] = value;
      }
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
    this.zone.show(positionToRange(position), DebugBreakpointWidget.LINE_HEIGHT_NUMBER);
  }

  hide() {
    this.zone?.hide();
  }
}
