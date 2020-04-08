import { Disposable, memoize } from '@ali/ide-core-common';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { IContextKey } from '@ali/ide-core-browser';

import { CommentsThread } from './comments-thread';

@Injectable({ multiple: true })
export class CommentsZoneService extends Disposable {
  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  private commentIsEmptyCtx: IContextKey<boolean>;

  constructor(@Optional() readonly thread: CommentsThread) {
    super();
    this.commentIsEmptyCtx = this.thread.contextKeyService.createKey('commentIsEmpty', false);
  }

  @memoize
  get commentThreadTitle() {
    return this.registerDispose(
      this.menuService.createMenu(
        MenuId.CommentsCommentThreadTitle,
        this.thread.contextKeyService,
      ),
    );
  }

  @memoize
  get commentThreadContext() {
    return this.registerDispose(
      this.menuService.createMenu(
        MenuId.CommentsCommentThreadContext,
        this.thread.contextKeyService,
      ),
    );
  }

  setCommentIsEmptyCtx(replyText) {
    this.commentIsEmptyCtx.set(!replyText);
  }

  updateReplyText(replyText) {
    this.setCommentIsEmptyCtx(!replyText);
  }
}
