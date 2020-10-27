import { Optional, Injectable, Autowired } from '@ali/common-di';
import { IContextKeyService, IContextKey } from '@ali/ide-core-browser';
import { OutlineSortTypeContext, OutlineFollowCursorContext } from '@ali/ide-core-browser/lib/contextkey';

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
