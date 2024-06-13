import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IContextKey, IContextKeyService, IScopedContextKeyService } from '@opensumi/ide-core-browser';
import {
  InlineChatIsVisible,
  InlineCompletionIsTrigger,
  InlineHintWidgetIsVisible,
  InlineInputWidgetIsVisible,
} from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import { ContextKeyService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import { IContextKeyServiceTarget } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

@Injectable()
export class AINativeContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly inlineChatIsVisible: IContextKey<boolean>;
  public readonly inlineCompletionIsTrigger: IContextKey<boolean>;
  public readonly inlineHintWidgetIsVisible: IContextKey<boolean>;
  public readonly inlineInputWidgetIsVisible: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement | IContextKeyServiceTarget | ContextKeyService) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.inlineChatIsVisible = InlineChatIsVisible.bind(this._contextKeyService);
    this.inlineCompletionIsTrigger = InlineCompletionIsTrigger.bind(this._contextKeyService);
    this.inlineHintWidgetIsVisible = InlineHintWidgetIsVisible.bind(this._contextKeyService);
    this.inlineInputWidgetIsVisible = InlineInputWidgetIsVisible.bind(this._contextKeyService);
  }
}
