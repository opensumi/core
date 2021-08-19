import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { CONTEXT_IN_DEBUG_REPL, CONTEXT_IN_DEBUG_MODE, CONTEXT_DEBUG_STATE } from './../../common/constants';
import { DebugState } from '../../common';

@Injectable()
export class DebugContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly contextInDebugRepl: IContextKey<boolean>;
  public readonly contextInDdebugMode: IContextKey<boolean>;
  public readonly contextDebugState: IContextKey<keyof typeof DebugState>;

  constructor(@Optional() dom?: HTMLElement) {
    const contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.contextInDebugRepl = CONTEXT_IN_DEBUG_REPL.bind(contextKeyService);
    this.contextInDdebugMode = CONTEXT_IN_DEBUG_MODE.bind(contextKeyService);
    this.contextDebugState = CONTEXT_DEBUG_STATE.bind(contextKeyService);
  }
}
