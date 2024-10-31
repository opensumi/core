import React from 'react';

import { Button } from '@opensumi/ide-components';
import {
  IContextKeyService,
  IMarkdownString,
  isString,
  isUndefined,
  localize,
  toLocalString,
  toMarkdownHtml,
  useAutorun,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { AbstractMenuService, IMenu, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';

import {
  CommentMode,
  ICommentReply,
  ICommentsCommentContext,
  ICommentsCommentTitle,
  ICommentsFeatureRegistry,
  ICommentsThread,
  ICommentsZoneWidget,
  IThreadComment,
} from '../common';

import { CommentReactionSwitcher, CommentReactions } from './comment-reactions.view';
import { CommentsBody } from './comments-body';
import { CommentsTextArea } from './comments-textarea.view';
import styles from './comments.module.less';

// TODO: 更好的时间格式化组件
const Timestamp: React.FC<{ timestamp: string }> = ({ timestamp }) => {
  const formatTimestamp = React.useMemo(() => {
    const date = new Date(timestamp);
    return toLocalString(date);
  }, [timestamp]);

  return <span className={styles.comment_item_timestamp}>{formatTimestamp}</span>;
};

const useCommentContext = (
  contextKeyService: IContextKeyService,
  comment: IThreadComment,
): [
  string | IMarkdownString,
  React.Dispatch<React.SetStateAction<string | IMarkdownString>>,
  (event: React.ChangeEvent<HTMLTextAreaElement>) => void,
  IMenu,
  IMenu,
  (files: FileList) => Promise<void>,
] => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const { body, contextValue } = comment;
  const [textValue, setTextValue] = React.useState<string | IMarkdownString>('');
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);
  // set textValue when body changed
  React.useEffect(() => {
    setTextValue(body);
  }, [body]);

  // Each comment has its own commentContext and commentTitleContext.
  const commentContextService = React.useMemo(() => contextKeyService.createScoped(), []);
  // it's value will true when textarea is empty
  const commentIsEmptyContext = React.useMemo(
    () => commentContextService.createKey<boolean>('commentIsEmpty', !comment.body),
    [],
  );
  // below the comment textarea
  const commentContext = React.useMemo(
    () => menuService.createMenu(MenuId.CommentsCommentContext, commentContextService),
    [],
  );
  // after the comment body
  const commentTitleContext = React.useMemo(
    () => menuService.createMenu(MenuId.CommentsCommentTitle, commentContextService),
    [],
  );

  const itemCommentContext = React.useRef(commentContextService.createKey('comment', contextValue));

  React.useEffect(() => {
    itemCommentContext.current.set(contextValue);
  }, [contextValue]);

  const onChangeTextArea = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    commentIsEmptyContext.set(!event.target.value);
    setTextValue(event.target.value);
  }, []);

  const handleDragFiles = React.useCallback(
    async (files: FileList) => {
      if (fileUploadHandler) {
        const appendText = await fileUploadHandler(textValue, files);
        setTextValue((text) => {
          const value = text + appendText;
          commentIsEmptyContext.set(!value);
          return value;
        });
      }
    },
    [textValue],
  );

  return [textValue, setTextValue, onChangeTextArea, commentContext, commentTitleContext, handleDragFiles];
};

const ReplyItem: React.FC<{
  reply: IThreadComment;
  thread: ICommentsThread;
}> = ({ reply, thread }) => {
  const { contextKeyService } = thread;
  const { author, label, body, mode, timestamp } = reply;
  const iconUrl = author.iconPath?.toString();
  const [textValue, setTextValue, onChangeTextArea, commentContext, commentTitleContext, handleDragFiles] =
    useCommentContext(contextKeyService, reply);

  // 判断是正常 Inline Text 还是 Markdown Text
  const isInlineText = React.useMemo(() => {
    const parsedStr = toMarkdownHtml(typeof body === 'string' ? body : body.value);
    // 解析出来非纯p标签的则为Markdown Text
    const isInline = /^\<p\>[^<>]+\<\/p\>\n$/.test(parsedStr);
    return isInline;
  }, [body]);

  return (
    <div className={styles.reply_item}>
      {isUndefined(mode) || mode === CommentMode.Preview ? (
        <div>
          {isInlineText ? (
            <>
              {iconUrl && <img className={styles.reply_item_icon} src={iconUrl} alt={author.name} />}
              <span className={styles.comment_item_author_name}>{author.name}</span>
              {timestamp && <Timestamp timestamp={timestamp} />}
              {typeof label === 'string' ? <span className={styles.comment_item_label}>{label}</span> : label}
              {' : '}
              <span className={styles.comment_item_body}>{typeof body === 'string' ? body : body.value}</span>
              {reply.reactions && reply.reactions.length > 0 && (
                <CommentReactionSwitcher className={styles.reply_item_title} thread={thread} comment={reply} />
              )}
              <InlineActionBar<ICommentsCommentTitle>
                separator='inline'
                className={styles.reply_item_title}
                menus={commentTitleContext}
                context={[
                  {
                    thread,
                    comment: reply,
                    menuId: MenuId.CommentsCommentTitle,
                  },
                ]}
                type='icon'
              />
            </>
          ) : (
            <>
              <div className={styles.comment_item_markdown_header}>
                <div>
                  {iconUrl && <img className={styles.reply_item_icon} src={iconUrl} alt={author.name} />}
                  <span className={styles.comment_item_author_name}>{author.name}</span>
                  {timestamp && <Timestamp timestamp={timestamp} />}
                  {typeof label === 'string' ? <span className={styles.comment_item_label}>{label}</span> : label}
                  {' : '}
                </div>
                <InlineActionBar<ICommentsCommentTitle>
                  separator='inline'
                  className={styles.reply_item_title}
                  menus={commentTitleContext}
                  context={[
                    {
                      thread,
                      comment: reply,
                      menuId: MenuId.CommentsCommentTitle,
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
            value={typeof textValue === 'string' ? textValue : textValue.value}
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
                menuId: MenuId.CommentsCommentContext,
              },
            ]}
            type='button'
            separator='inline'
            afterClick={() => {
              // restore textarea value
              setTextValue(body);
            }}
          />
        </div>
      )}
      {reply.reactions && reply.reactions.length > 0 && <CommentReactions thread={thread} comment={reply} />}
    </div>
  );
};

export const CommentItem: React.FC<{
  thread: ICommentsThread;
  commentThreadContext: IMenu;
  widget: ICommentsZoneWidget;
}> = ({ thread, commentThreadContext, widget }) => {
  const [showReply, setShowReply] = React.useState(false);
  const [replyText, setReplyText] = React.useState('');

  const { contextKeyService } = thread;
  const readOnly = useAutorun(thread.readOnly);
  const [comment, ...replies] = useAutorun(thread.comments);

  const { author, label, body, mode, timestamp } = comment;
  const iconUrl = !isString(author.iconPath)
    ? author.iconPath?.authority
      ? author.iconPath?.toString()
      : ''
    : author.iconPath;
  const [textValue, setTextValue, onChangeTextArea, commentContext, commentTitleContext, handleDragFiles] =
    useCommentContext(contextKeyService, comment);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);
  const replyIsEmptyContext = React.useMemo(() => contextKeyService.createKey<boolean>('commentIsEmpty', true), []);

  // modify reply
  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    replyIsEmptyContext.set(!event.target.value);
    setReplyText(event.target.value);
  }

  const handleDragFilesToReply = React.useCallback(
    async (files: FileList) => {
      if (fileUploadHandler) {
        const appendText = await fileUploadHandler(textValue, files);
        setReplyText((text) => {
          const value = text + appendText;
          replyIsEmptyContext.set(!value);
          return value;
        });
      }
    },
    [replyText],
  );

  return (
    <div className={styles.comment_item}>
      {iconUrl && <img className={styles.comment_item_icon} src={iconUrl} alt={author.name} />}
      <div className={styles.comment_item_content}>
        <div className={styles.comment_item_head}>
          <div className={styles.comment_item_name}>
            <span className={styles.comment_item_author_name}>{author.name}</span>
            {timestamp && <Timestamp timestamp={timestamp} />}
            {typeof label === 'string' ? <span className={styles.comment_item_label}>{label}</span> : label}
          </div>
          <div className={styles.comment_item_actions}>
            {comment.reactions && comment.reactions.length > 0 && (
              <CommentReactionSwitcher thread={thread} comment={comment} />
            )}
            {!readOnly && (
              <Button
                className={styles.comment_item_reply_button}
                size='small'
                type='secondary'
                onClick={() => setShowReply(true)}
              >
                {localize('comments.thread.action.reply')}
              </Button>
            )}
            <InlineActionBar<ICommentsCommentTitle>
              menus={commentTitleContext}
              context={[
                {
                  thread,
                  comment,
                  menuId: MenuId.CommentsCommentTitle,
                },
              ]}
              type='button'
            />
          </div>
        </div>
        {isUndefined(mode) || mode === CommentMode.Preview ? (
          <CommentsBody body={body} />
        ) : (
          <div>
            <CommentsTextArea
              value={typeof textValue === 'string' ? textValue : textValue.value}
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
                  menuId: MenuId.CommentsCommentContext,
                },
              ]}
              separator='inline'
              type='button'
              afterClick={() => {
                // restore textarea value
                setTextValue(body);
              }}
            />
          </div>
        )}
        {comment.reactions && comment.reactions.length > 0 && <CommentReactions thread={thread} comment={comment} />}
        {(replies.length > 0 || showReply) && (
          <div className={styles.comment_item_reply_wrap}>
            {replies.map((reply) => (
              <ReplyItem key={reply.id} thread={thread} reply={reply} />
            ))}
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
                  context={[
                    {
                      thread,
                      text: replyText,
                      widget,
                      menuId: MenuId.CommentsCommentThreadContext,
                    },
                  ]}
                  separator='inline'
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
};
