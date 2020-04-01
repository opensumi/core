import * as React from 'react';
import * as styles from './comments.module.less';
import { IComment, ICommentsThread, ICommentsCommentTitle, CommentMode } from '../common';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { observer } from 'mobx-react-lite';
import { CommentsTextArea } from './comments-textarea.view';
import { IMenu, AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { useInjectable } from '@ali/ide-core-browser';

export const CommentItem: React.FC<{
  thread: ICommentsThread,
  comment: IComment,
}> = observer((
  {
    comment,
    thread,
  },
) => {
  const { author, label, body, mode } = comment;
  const { contextKeyService } = thread;
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const [ commentTitleContext, setCommentTitleContext ] = React.useState<IMenu>();
  const [ commentContext, setCommentContext ] = React.useState<IMenu>();
  const iconUrl = author.iconPath?.toString();

  React.useEffect(() => {
    const commentContextService = contextKeyService.createScoped();
    commentContextService.createKey('comment', comment.contextValue);
    const commentContext = menuService.createMenu(MenuId.CommentsCommentContext, commentContextService);
    const commentTitleContext = menuService.createMenu(MenuId.CommentsCommentTitle, commentContextService);
    setCommentContext(commentContext);
    setCommentTitleContext(commentTitleContext);

    return () => {
      commentContext.dispose();
      commentTitleContext.dispose();
    };
  }, []);

  return (
  <div className={styles.comment_item}>
    <div className={styles.comment_item_head}>
      <div  className={styles.comment_item_author}>
        {iconUrl && <img className={styles.comment_item_icon} src={iconUrl} alt={author.name}/>}
        <div>
          <span className={styles.comment_item_author_name}>{author.name}</span>
          {typeof label === 'string' ? <span className={styles.comment_item_label}>{label}</span> : label}
        </div>
      </div>
      {commentTitleContext && (
        <InlineActionBar<ICommentsCommentTitle>
          className={styles.comment_item_title_context}
          menus={commentTitleContext}
          context={[{
            thread,
            comment,
          }]}
          separator='inline'
          type='icon'
        />
      )}
    </div>
    { mode === CommentMode.Preview ? (
      <div>{body}</div>
    ) : (
      <CommentsTextArea
        value={comment.body}
        autoFocus={true}
        onChange={(e) => {
          comment.body = e.target.value;
        }}
        rows={2}
      />
    ) }
    {commentContext && (
      <InlineActionBar<ICommentsCommentTitle>
        className={styles.comment_item_context}
        menus={commentContext}
        context={[{
          thread,
          comment,
        }]}
        type='secondary'
      />
    )}
  </div>
  );
});
