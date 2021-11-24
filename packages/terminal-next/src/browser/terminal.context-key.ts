import { Optional, Injectable, Autowired } from '@opensumi/common-di';
import { IContextKeyService, IContextKey } from '@opensumi/ide-core-browser';
import { IsTerminalFocused, IsTerminalViewInitialized } from '@opensumi/ide-core-browser/lib/contextkey';

@Injectable()
export class TerminalContextKey {

  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly isTerminalFocused: IContextKey<boolean>;
  public readonly isTerminalViewInitialized: IContextKey<boolean>;

  private readonly _contextKeyService: IContextKeyService;

  constructor(@Optional() dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextkeyService.createScoped(dom);
    this.isTerminalFocused = IsTerminalFocused.bind(this._contextKeyService);
    this.isTerminalViewInitialized = IsTerminalViewInitialized.bind(this._contextKeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
