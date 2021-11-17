import { IContextKey, IContextKeyService } from '@ide-framework/ide-core-browser';
import { CONTEXT_BREAKPOINT_INPUT_FOCUSED } from './../../common/constants';
import * as monaco from '@ide-framework/monaco-editor-core/esm/vs/editor/editor.api';
import { Disposable, positionToRange } from '@ide-framework/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ide-framework/common-di';
import { DebugEditor } from '../../common';
import { DebugBreakpointZoneWidget, DebugBreakpointWidgetContext } from './debug-breakpoint-zone-widget';
import { DebugBreakpointsService } from '../view/breakpoints/debug-breakpoints.service';

export enum TopStackType {
  exception,
  debugger,
}

@Injectable()
export class DebugBreakpointWidget extends Disposable {

  @Autowired(DebugEditor)
  private readonly editor: DebugEditor;

  @Autowired(DebugBreakpointsService)
  protected debugBreakpointsService: DebugBreakpointsService;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  static LINE_HEIGHT_NUMBER = 2;

  protected zone: DebugBreakpointZoneWidget;

  private _position: monaco.Position | undefined;
  private breakpointWidgetInputFocus: IContextKey<boolean>;

  constructor() {
    super();
    this.breakpointWidgetInputFocus = CONTEXT_BREAKPOINT_INPUT_FOCUSED.bind(this.contextKeyService);
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
