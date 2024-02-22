import { Autowired, Injectable } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import { DialogViewVisibleContext } from '@opensumi/ide-core-browser/lib/contextkey/dialog';

@Injectable()
export class DialogContextKey {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly dialogViewVisibleContext: IContextKey<boolean>;

  private readonly _contextKeyService: IContextKeyService;

  constructor() {
    this._contextKeyService = this.globalContextKeyService;
    this.dialogViewVisibleContext = DialogViewVisibleContext.bind(this._contextKeyService);
  }
}
