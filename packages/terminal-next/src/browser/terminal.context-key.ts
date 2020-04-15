import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { IsTerminalFocused, IsTerminalViewInitialized } from '@ali/ide-core-browser/lib/contextkey';

@Injectable()
export class TerminalContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly isTerminalFocused: IContextKey<boolean>;
  public readonly isTerminalViewInitialized: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextkeyService;
    this.isTerminalFocused = IsTerminalFocused.bind(contextKeyService);
    this.isTerminalViewInitialized = IsTerminalViewInitialized.bind(contextKeyService);
  }
}
