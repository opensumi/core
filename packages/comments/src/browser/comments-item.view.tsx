import * as React from 'react';
import * as styles from './comments.module.less';
import { IThreadComment, ICommentsCommentTitle, CommentMode, ICommentReply, ICommentsCommentContext} from '../common';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { autorun } from 'mobx';
import { observer } from 'mobx-react-lite';
import { CommentsTextArea } from './comments-textarea.view';
import { AbstractMenuService, MenuId, IMenu } from '@ali/ide-core-browser/lib/menu/next';
import { useInjectable, localize, IContextKeyService } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { CommentsThread } from './comments-thread';

const useCommentContext
  = (contextKeyService: IContextKeyService, comment: IThreadComment)
  : [ string,  React.Dispatch<React.SetStateAction<string>>, (event: React.ChangeEvent<HTMLTextAreaElement>) => void, IMenu, IMenu] => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const { body } = comment;
  const [ textValue, setTextValue ] = React.useState('');

  // set textValue when body changed
  React.useEffect(() => {
    setTextValue(body);
  }, [body]);

  // Each comment has its own commentContext and commentTitleContext.
  const commentContextService = React.useMemo(() => {
    return contextKeyService.createScoped();
  }, []);
  // it's value will true when textarea is empty
  const commentIsEmptyContext = React.useMemo(() => {
    return commentContextService.createKey<boolean>('commentIsEmpty', !comment.body);
  }, []);
  // below the comment textarea
  const commentContext = React.useMemo(() => {
    return menuService.createMenu(
      MenuId.CommentsCommentContext,
      commentContextService,
    );
  }, []);
  // after the comment body
  const commentTitleContext = React.useMemo(() => {
    return menuService.createMenu(
      MenuId.CommentsCommentTitle,
      commentContextService,
    );
  }, []);

  React.useEffect(() => {
    autorun(() => {
      commentContextService.createKey('comment', comment.contextValue);
    });
  }, []);

  const onChangeTextArea = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    commentIsEmptyContext.set(!event.target.value);
    setTextValue(event.target.value);
  }, []);

  return [
    textValue,
    setTextValue,
    onChangeTextArea,
    commentContext,
    commentTitleContext,
  ];
};

const ReplyItem: React.FC<{
  reply: IThreadComment,
  thread: CommentsThread,
}> = observer(({ reply, thread }) => {
  const { contextKeyService } = thread;
  const { author, label, body, mode } = reply;
  const iconUrl = author.iconPath?.toString();
  const [
    textValue,
    setTextValue,
    onChangeTextArea,
    commentContext,
    commentTitleContext,
  ] = useCommentContext(contextKeyService, reply);

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
            menus={commentTitleContext}
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
        <div>
          <CommentsTextArea
            value={textValue}
            focusDelay={100}
            onChange={onChangeTextArea}
            rows={2}
          />
          <InlineActionBar<ICommentsCommentContext>
            className={styles.comment_item_context}
            menus={commentContext}
            context={[
              {
                thread,
                comment: reply,
                body: textValue,
              },
            ]}
            type='button'
            afterClick={() => {
              // restore textarea value
              setTextValue(body);
            }}
          />
        </div>
      )}
    </div>
  );
});

export const CommentItem: React.FC<{
  thread: CommentsThread,
  commentThreadContext: IMenu,
}> = observer(({ thread, commentThreadContext }) => {
  const { readOnly, contextKeyService } = thread;
  const [ showReply, setShowReply ] = React.useState(false);
  const [ replyText, setReplyText ] = React.useState('');
  const [ comment, ...replies ] = thread.comments;
  const { author, label, body, mode } = comment;
  const iconUrl = author.iconPath?.toString();
  const [
    textValue,
    setTextValue,
    onChangeTextArea,
    commentContext,
    commentTitleContext,
  ] = useCommentContext(contextKeyService, comment);
  const replyIsEmptyContext = React.useMemo(() => {
    return contextKeyService.createKey('commentIsEmpty', true);
  }, []);

  // modify reply
  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    replyIsEmptyContext.set(!event.target.value);
    setReplyText(event.target.value);
  }

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
          {!readOnly && (
            <Button className={styles.comment_item_reply_button} size='small' type='secondary' onClick={() => setShowReply(true)}>
            {localize('comments.thread.action.reply')}
            </Button>
          )}
          <InlineActionBar<ICommentsCommentTitle>
            menus={commentTitleContext}
            context={[
              {
                thread,
                comment,
              },
            ]}
            type='button'
          />
          </div>
        </div>
        {mode === CommentMode.Preview ? (
          <div className={styles.comment_item_body}>{body}</div>
        ) : (
            <div>
              <CommentsTextArea
              value={textValue}
              focusDelay={100}
              onChange={onChangeTextArea}
              rows={2}
            />
            <InlineActionBar<ICommentsCommentContext>
              className={styles.comment_item_context}
              menus={commentContext}
              context={[
                {
                  thread,
                  comment,
                  body: textValue,
                },
              ]}
              type='button'
              afterClick={() => {
                // restore textarea value
                setTextValue(body);
              }}
            />
          </div>
        )}
        {(replies.length > 0 || showReply) && (
          <div className={styles.comment_item_reply_wrap}>
            {replies.map((reply) => <ReplyItem key={reply.id} thread={thread} reply={reply} />)}
            {showReply && (
               <div>
                 <CommentsTextArea
                  focusDelay={100}
                  value={replyText}
                  onChange={onChangeReply}
                  placeholder={`${localize('comments.reply.placeholder')}...`}
                />
                <InlineActionBar<ICommentReply>
                  className={styles.comment_item_reply}
                  menus={commentThreadContext}
                  context={[{
                    thread,
                    text: replyText,
                  }]}
                  type='button'
                  afterClick={() => {
                    setReplyText('');
                    setShowReply(false);
                  }}
                />
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
