import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import { Disposable, positionToRange } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  DebugBreakpointWidgetContext,
  DebugEditor,
  IDebugBreakpointWidget,
  TSourceBrekpointProperties,
} from '../../common';
import { DebugBreakpointsService } from '../view/breakpoints/debug-breakpoints.service';

import { CONTEXT_BREAKPOINT_INPUT_FOCUSED } from './../../common/constants';
import { DebugBreakpointZoneWidget } from './debug-breakpoint-zone-widget';

export enum TopStackType {
  exception,
  debugger,
}

@Injectable()
export class DebugBreakpointWidget extends Disposable implements IDebugBreakpointWidget {
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

  get breakpointType(): TSourceBrekpointProperties {
    return this.zone?.breakpointType;
  }

  show(
    position: monaco.Position,
    contexts?: DebugBreakpointWidgetContext,
    defaultContext: TSourceBrekpointProperties = 'condition',
  ) {
    this.dispose();
    this._position = position;
    this.addDispose(
      (this.zone = this.injector.get(DebugBreakpointZoneWidget, [this.editor, { ...contexts }, defaultContext])),
    );
    this.addDispose(
      this.zone.onDidChangeBreakpoint(({ context, value }) => {
        if (contexts) {
          contexts[context] = value;
        }
      }),
    );
    this.addDispose(
      this.zone.onFocus(() => {
        this.breakpointWidgetInputFocus.set(true);
      }),
    );
    this.addDispose(
      this.zone.onBlur(() => {
        this.breakpointWidgetInputFocus.set(false);
      }),
    );
    this.addDispose(
      this.zone.onDispose(() => {
        this._position = undefined;
        this.breakpointWidgetInputFocus.set(false);
      }),
    );
    this.zone.show(positionToRange(position), DebugBreakpointWidget.LINE_HEIGHT_NUMBER);
  }

  hide() {
    this.zone?.hide();
  }
}
