import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IContextKey, IContextKeyService } from '@opensumi/ide-core-browser';
import { OutlineFollowCursorContext, OutlineSortTypeContext } from '@opensumi/ide-core-browser/lib/contextkey';

@Injectable()
export class OutlineContextKeyService {
  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  public readonly outlineSortTypeContext: IContextKey<number>;
  public readonly outlineFollowCursorContext: IContextKey<boolean>;

  constructor(@Optional() contextKeyService: IContextKeyService) {
    contextKeyService = contextKeyService || this.globalContextKeyService;
    this.outlineSortTypeContext = OutlineSortTypeContext.bind(contextKeyService);
    this.outlineFollowCursorContext = OutlineFollowCursorContext.bind(contextKeyService);
  }
}
