import { Optional, Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey, IScopedContextKeyService } from '@opensumi/ide-core-browser';
import { InlineChatIsVisible, InlineCompletionIsTrigger } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { ContextKeyService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import { IContextKeyServiceTarget } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

@Injectable()
export class AiNativeContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly inlineChatIsVisible: IContextKey<boolean>;
  public readonly inlineCompletionIsTrigger: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement | IContextKeyServiceTarget | ContextKeyService) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.inlineChatIsVisible = InlineChatIsVisible.bind(this._contextKeyService);
    this.inlineCompletionIsTrigger = InlineCompletionIsTrigger.bind(this._contextKeyService);
  }
}
