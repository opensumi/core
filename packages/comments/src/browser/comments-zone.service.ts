import { Disposable, memoize } from '@ali/ide-core-common';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { AbstractMenuService, MenuId, IMenu } from '@ali/ide-core-browser/lib/menu/next';

import { CommentsThread } from './comments-thread';

@Injectable({ multiple: true })
export class CommentsZoneService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  constructor(@Optional() readonly thread: CommentsThread) {
    super();
  }

  @memoize
  get commentThreadTitle(): IMenu {
    return this.registerDispose(
      this.menuService.createMenu(
        MenuId.CommentsCommentThreadTitle,
        this.thread.contextKeyService,
      ),
    );
  }

  @memoize
  get commentThreadContext(): IMenu {
    return this.registerDispose(
      this.menuService.createMenu(
        MenuId.CommentsCommentThreadContext,
        this.thread.contextKeyService,
      ),
    );
  }
}
