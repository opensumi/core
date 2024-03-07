import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IContextKey, IContextKeyService, IScopedContextKeyService } from '@opensumi/ide-core-browser';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { ContextKeyService, IContextKeyServiceTarget } from '@opensumi/ide-monaco';

@Injectable()
export class AINativeContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly inlineChatIsVisible: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement | IContextKeyServiceTarget | ContextKeyService) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.inlineChatIsVisible = InlineChatIsVisible.bind(this._contextKeyService);
  }
}
