import { Optional, Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey, IScopedContextKeyService } from '@opensumi/ide-core-browser';

import { DebugState } from '../../common';

import {
  CONTEXT_IN_DEBUG_REPL,
  CONTEXT_IN_DEBUG_CONSOLE,
  CONTEXT_IN_DEBUG_MODE,
  CONTEXT_DEBUG_STATE,
  CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT,
  CONTEXT_SET_VARIABLE_SUPPORTED,
  CONTEXT_RESTART_FRAME_SUPPORTED,
  CONTEXT_DEBUG_PROTOCOL_VARIABLE_MENU_CONTEXT,
  CONTEXT_CAN_VIEW_MEMORY,
  CONTEXT_EXCEPTION_WIDGET_VISIBLE,
} from './../../common/constants';

@Injectable()
export class DebugContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly contextInDebugRepl: IContextKey<boolean>;
  public readonly contextInDebugConsole: IContextKey<boolean>;
  public readonly contextInDebugMode: IContextKey<boolean>;
  public readonly contextDebugState: IContextKey<keyof typeof DebugState>;
  public readonly contextVariableEvaluateNamePresent: IContextKey<boolean>;
  public readonly contextSetVariableSupported: IContextKey<boolean>;
  public readonly contextRestartFrameSupported: IContextKey<boolean>;
  public readonly contextDebugProtocolVariableMenu: IContextKey<string>;
  public readonly contextCanViewMemory: IContextKey<boolean>;
  public readonly contextExceptionWidgetVisible: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.contextInDebugRepl = CONTEXT_IN_DEBUG_REPL.bind(this.contextKeyScoped);
    this.contextInDebugConsole = CONTEXT_IN_DEBUG_CONSOLE.bind(this.contextKeyScoped);
    this.contextInDebugMode = CONTEXT_IN_DEBUG_MODE.bind(this.contextKeyScoped);
    this.contextDebugState = CONTEXT_DEBUG_STATE.bind(this.contextKeyScoped);
    this.contextVariableEvaluateNamePresent = CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.bind(this.contextKeyScoped);
    this.contextSetVariableSupported = CONTEXT_SET_VARIABLE_SUPPORTED.bind(this.contextKeyScoped);
    this.contextRestartFrameSupported = CONTEXT_RESTART_FRAME_SUPPORTED.bind(this.contextKeyScoped);
    this.contextDebugProtocolVariableMenu = CONTEXT_DEBUG_PROTOCOL_VARIABLE_MENU_CONTEXT.bind(this.contextKeyScoped);
    this.contextCanViewMemory = CONTEXT_CAN_VIEW_MEMORY.bind(this.contextKeyScoped);
    this.contextExceptionWidgetVisible = CONTEXT_EXCEPTION_WIDGET_VISIBLE.bind(this._contextKeyService);
  }

  public get contextKeyScoped(): IScopedContextKeyService {
    return this._contextKeyService!;
  }
}
