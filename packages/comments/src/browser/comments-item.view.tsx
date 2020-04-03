import * as React from 'react';
import * as styles from './comments.module.less';
import { IThreadComment, ICommentsCommentTitle, CommentMode} from '../common';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { observer } from 'mobx-react-lite';
import { CommentsTextArea } from './comments-textarea.view';
import { IMenu, AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { CommentsThread } from './comments-thread';

const ReplyItem: React.FC<{
  reply: IThreadComment,
  thread: CommentsThread,
}> = ({ reply, thread }) => {
  const { contextKeyService } = thread;
  const { author, label, body, mode } = reply;
  const iconUrl = author.iconPath?.toString();
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const commentContextService = React.useRef(contextKeyService.createScoped());
  const commentTitleContext = React.useRef(menuService.createMenu(
    MenuId.CommentsCommentTitle,
    commentContextService.current,
  ));
  // const commentContext = React.useRef(menuService.createMenu(
  //   MenuId.CommentsCommentContext,
  //   commentContextService.current,
  // ));

  // Each comment has its own commentContext and commentTitleContext.
  React.useEffect(() => {
    commentContextService.current.createKey('comment', reply.contextValue);
  }, [reply.contextValue]);
  return (
    <div className={styles.reply_item}>
      {mode === CommentMode.Preview ? (
        <div>
          {iconUrl && (
            <img
              className={styles.reply_item_icon}
              src={iconUrl}
              alt={author.name}
            />
          ) }
          <span className={styles.comment_item_author_name}>
            {author.name}
          </span>
          {typeof label === 'string' ? (
            <span className={styles.comment_item_label}>{label}</span>
          ) : (
            label
          )}
          { ' : ' }
          <span className={styles.comment_item_body}>{body}</span>
          <InlineActionBar<ICommentsCommentTitle>
            separator='inline'
            className={styles.reply_item_title}
            menus={commentTitleContext.current}
            context={[
              {
                thread,
                comment: reply,
              },
            ]}
            type='icon'
          />
        </div>
      ) : (
        <CommentsTextArea
          value={body}
          autoFocus={true}
          onChange={(e) => {
            // body = e.target.value;
          }}
          rows={2}
        />
      )}
    </div>
  );
};

export const CommentItem: React.FC<{
  thread: CommentsThread,
}> = observer(({ thread }) => {
  const { readOnly, contextKeyService } = thread;
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const commentContextService = React.useRef(contextKeyService.createScoped());
  // const commentContext = menuService.createMenu(
  //   MenuId.CommentsCommentContext,
  //   commentContextService.current,
  // );
  const commentTitleContext = menuService.createMenu(
    MenuId.CommentsCommentTitle,
    commentContextService.current,
  );
  const comment = React.useMemo(() => {
    return thread.comments[0];
  }, thread.comments);
  const replies =  React.useMemo(() => {
    const [, ...rest ] = thread.comments;
    return rest;
  }, thread.comments);
  const { author, label, body, mode } = comment;
  const iconUrl = author.iconPath?.toString();

  // Each comment has its own commentContext and commentTitleContext.
  React.useEffect(() => {
    commentContextService.current.createKey('comment', comment.contextValue);
  }, [comment.contextValue]);

  return (
    <div className={styles.comment_item}>
      {iconUrl && (
        <img
          className={styles.comment_item_icon}
          src={iconUrl}
          alt={author.name}
        />
      )}
      <div className={styles.comment_item_content}>
        <div className={styles.comment_item_head}>
          <div className={styles.comment_item_name}>
            <span className={styles.comment_item_author_name}>
              {author.name}
            </span>
            {typeof label === 'string' ? (
              <span className={styles.comment_item_label}>{label}</span>
            ) : (
              label
            )}
          </div>
          <div className={styles.comment_item_actions}>
          {/* <InlineActionBar<ICommentsCommentTitle>
              menus={commentThreadComment}
              context={[
                {
                  thread,
                  comment,
                },
              ]}
              type='secondary'
            /> */}
          {!readOnly && (
            <Button className={styles.comment_item_reply_button} size='small' type='secondary' onClick={() => {}}>
            {localize('comments.thread.action.reply')}
            </Button>
          )}
          {commentTitleContext && (
            <InlineActionBar<ICommentsCommentTitle>
              menus={commentTitleContext}
              context={[
                {
                  thread,
                  comment,
                },
              ]}
              type='secondary'
            />
          )}
          </div>
        </div>
        {mode === CommentMode.Preview ? (
          <div className={styles.comment_item_body}>{body}</div>
        ) : (
          <CommentsTextArea
            value={comment.body}
            autoFocus={true}
            onChange={(e) => {
              comment.body = e.target.value;
            }}
            rows={2}
          />
        )}
        {replies.length > 0 && (
          <div className={styles.comment_item_reply_wrap}>
            {replies.map((reply) => <ReplyItem thread={thread} reply={reply} />)}
          </div>
        )}
      </div>
      {/* {commentContext && (
      <InlineActionBar<ICommentsCommentTitle>
        className={styles.comment_item_context}
        menus={commentContext}
        context={[{
          thread,
          comment,
        }]}
        type='secondary'
      />
    )} */}
    </div>
  );
});
