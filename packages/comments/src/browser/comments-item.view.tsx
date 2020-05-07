import * as React from 'react';
import * as styles from './comments.module.less';
import { IThreadComment, ICommentsCommentTitle, CommentMode, ICommentReply, ICommentsCommentContext, ICommentsZoneWidget, ICommentsFeatureRegistry} from '../common';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { observer } from 'mobx-react-lite';
import { CommentsTextArea } from './comments-textarea.view';
import { AbstractMenuService, MenuId, IMenu } from '@ali/ide-core-browser/lib/menu/next';
import { useInjectable, localize, IContextKeyService } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { CommentsThread } from './comments-thread';
import { CommentsBody } from './comments-body';
import * as marked from 'marked';

const useCommentContext
  = (contextKeyService: IContextKeyService, comment: IThreadComment)
  : [ string,  React.Dispatch<React.SetStateAction<string>>, (event: React.ChangeEvent<HTMLTextAreaElement>) => void, IMenu, IMenu, (files: FileList) => Promise<void>] => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const { body, contextValue } = comment;
  const [ textValue, setTextValue ] = React.useState('');
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);

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

  const itemCommentContext = React.useRef(commentContextService.createKey('comment', contextValue));

  React.useEffect(() => {
    itemCommentContext.current.set(contextValue);
  }, [contextValue]);

  const onChangeTextArea = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    commentIsEmptyContext.set(!event.target.value);
    setTextValue(event.target.value);
  }, []);

  const handleDragFiles = React.useCallback(async (files: FileList) => {
    if (fileUploadHandler) {
      const appendText = await fileUploadHandler(textValue, files);
      setTextValue((text) => {
        const value = text + appendText;
        commentIsEmptyContext.set(!value);
        return value;
      });
    }
  }, [ textValue ]);

  return [
    textValue,
    setTextValue,
    onChangeTextArea,
    commentContext,
    commentTitleContext,
    handleDragFiles,
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
    handleDragFiles,
  ] = useCommentContext(contextKeyService, reply);

  // 判断是正常 Inline Text 还是 Markdown Text
  const isInlineText = React.useMemo(() => {
    const lexer = marked.lexer(body);
    const token = lexer[0] as marked.Tokens.Paragraph;
    const isParagraph = token?.type === 'paragraph';
    return isParagraph && !token?.text.includes('\n');
  }, [body]);

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
          { isInlineText ? (
            <>
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
            </>
          ) : (
            <>
              <div className={styles.comment_item_markdown_header}>
                <div>
                  <span className={styles.comment_item_author_name}>
                  {author.name}
                  </span>
                  {typeof label === 'string' ? (
                    <span className={styles.comment_item_label}>{label}</span>
                  ) : (
                    label
                  )}
                  { ' : ' }
                </div>
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
              <CommentsBody body={body} />
            </>
          )}
        </div>
      ) : (
        <div>
          <CommentsTextArea
            value={textValue}
            autoFocus={true}
            onChange={onChangeTextArea}
            dragFiles={handleDragFiles}
          />
          <InlineActionBar<ICommentsCommentContext>
            className={styles.comment_item_reply}
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
  widget: ICommentsZoneWidget,
}> = observer(({ thread, commentThreadContext, widget }) => {
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
    handleDragFiles,
  ] = useCommentContext(contextKeyService, comment);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);
  const replyIsEmptyContext = React.useMemo(() => {
    return contextKeyService.createKey('commentIsEmpty', true);
  }, []);

  // modify reply
  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    replyIsEmptyContext.set(!event.target.value);
    setReplyText(event.target.value);
  }

  const handleDragFilesToReply = React.useCallback(async (files: FileList) => {
    if (fileUploadHandler) {
      const appendText = await fileUploadHandler(textValue, files);
      setReplyText((text) => {
        const value = text + appendText;
        replyIsEmptyContext.set(!value);
        return value;
      });
    }
  }, [ replyText ]);

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
          <CommentsBody body={body} />
        ) : (
            <div>
              <CommentsTextArea
              value={textValue}
              autoFocus={true}
              onChange={onChangeTextArea}
              dragFiles={handleDragFiles}
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
                autoFocus={true}
                value={replyText}
                onChange={onChangeReply}
                placeholder={`${localize('comments.reply.placeholder')}...`}
                dragFiles={handleDragFilesToReply}
              />
              <InlineActionBar<ICommentReply>
                className={styles.comment_item_reply}
                menus={commentThreadContext}
                context={[{
                  thread,
                  text: replyText,
                  widget,
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
