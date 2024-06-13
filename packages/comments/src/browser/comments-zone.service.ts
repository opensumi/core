import { Autowired, Injectable, Optional } from '@opensumi/di';
import { AbstractMenuService, IMenu, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { Disposable, memoize } from '@opensumi/ide-core-common';

import { ICommentsService } from '../common';

import { CommentsThread } from './comments-thread';

@Injectable({ multiple: true })
export class CommentsZoneService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICommentsService)
  private readonly commentService: ICommentsService;

  constructor(@Optional() readonly thread: CommentsThread) {
    super();
  }

  setCurrentCommentThread(thread?: CommentsThread) {
    this.commentService.setCurrentCommentThread(thread);
  }

  @memoize
  get commentThreadTitle(): IMenu {
    return this.registerDispose(
      this.menuService.createMenu(MenuId.CommentsCommentThreadTitle, this.thread.contextKeyService),
    );
  }

  @memoize
  get commentThreadContext(): IMenu {
    return this.registerDispose(
      this.menuService.createMenu(MenuId.CommentsCommentThreadContext, this.thread.contextKeyService),
    );
  }
}
