import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey, IScopedContextKeyService } from '@ali/ide-core-browser';
import { CONTEXT_IN_DEBUG_REPL, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE, CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT } from './../../common/constants';
import { DebugState } from '../../common';

@Injectable()
export class DebugContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly contextInDebugRepl: IContextKey<boolean>;
  public readonly contextInDdebugMode: IContextKey<boolean>;
  public readonly contextDebugState: IContextKey<keyof typeof DebugState>;
  public readonly contextVariableEvaluateNamePresent: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.contextInDebugRepl = CONTEXT_IN_DEBUG_REPL.bind(this.contextKeyScoped);
    this.contextInDdebugMode = CONTEXT_IN_DEBUG_MODE.bind(this.contextKeyScoped);
    this.contextDebugState = CONTEXT_DEBUG_STATE.bind(this.contextKeyScoped);
    this.contextVariableEvaluateNamePresent = CONTEXT_VARIABLE_EVALUATE_NAME_PRESENT.bind(this.contextKeyScoped);
  }

  public get contextKeyScoped(): IScopedContextKeyService {
    return this._contextKeyService!;
  }
}
