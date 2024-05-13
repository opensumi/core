import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import {
  IsTerminalFocused,
  IsTerminalViewInitialized,
  ShellExecutionSupported,
} from '@opensumi/ide-core-browser/lib/contextkey';

@Injectable()
export class TerminalContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextkeyService: IContextKeyService;

  public readonly isTerminalFocused: IContextKey<boolean>;
  public readonly isTerminalViewInitialized: IContextKey<boolean>;
  public readonly shellExecutionSupportedContextKey: IContextKey<boolean>;
  private readonly _contextKeyService: IContextKeyService;

  constructor(@Optional() dom: HTMLDivElement) {
    this._contextKeyService = this.globalContextkeyService.createScoped(dom);
    this.isTerminalFocused = IsTerminalFocused.bind(this._contextKeyService);
    this.isTerminalViewInitialized = IsTerminalViewInitialized.bind(this._contextKeyService);
    this.shellExecutionSupportedContextKey = ShellExecutionSupported.bind(this.globalContextkeyService);
  }

  get service() {
    return this._contextKeyService;
  }
}
