import { Optional, Injectable, Autowired } from '@opensumi/di';
import { IContextKeyService, IContextKey, IScopedContextKeyService } from '@opensumi/ide-core-browser';
import { TestingIsPeekVisible } from '@opensumi/ide-core-browser/lib/contextkey/testing';
import { ContextKeyService } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/browser/contextKeyService';
import { IContextKeyServiceTarget } from '@opensumi/monaco-editor-core/esm/vs/platform/contextkey/common/contextkey';

@Injectable()
export class TestContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private _contextKeyService: IScopedContextKeyService | undefined;

  public readonly contextTestingIsPeekVisible: IContextKey<boolean>;

  constructor(@Optional() dom?: HTMLElement | IContextKeyServiceTarget | ContextKeyService) {
    this._contextKeyService = this.globalContextKeyService.createScoped(dom);
    this.contextTestingIsPeekVisible = TestingIsPeekVisible.bind(this.contextKeyScoped);
  }

  public get contextKeyScoped(): IScopedContextKeyService {
    return this._contextKeyService!;
  }
}
