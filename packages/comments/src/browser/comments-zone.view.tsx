import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as styles from './comments.module.less';
import { getIcon, ConfigProvider, IRange, localize } from '@ali/ide-core-browser';
import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { ICommentReply } from '../common';
import * as clx from 'classnames';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { ResizeZoneWidget } from '@ali/ide-monaco-enhance';
import { CommentsThread } from './comments-thread';

const expandIconClassName = getIcon('down');

export interface ICommentProps {
  thread: CommentsThread;
  hide: () => void;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, hide }) => {
  const { commentThreadContext, readOnly, comments } = thread;
  const [isFocusReply, setFocusReply] = React.useState(true);
  const [rows, setRows] = React.useState(5);
  const [replyText, setReplyText] = React.useState('');

  function onBlurReply(event: React.FocusEvent<HTMLTextAreaElement>) {
    // setFocusReply(false);
    if (replyText === '') {
      // setRows(1);
    }
  }

  function onFocusReply(event: React.FocusEvent<HTMLTextAreaElement>) {
    // setFocusReply(true);
    if (replyText === '') {
      // setRows(5);
    }
  }

  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setReplyText(event.target.value);
  }

  const commentTitleWithAuthor = React.useMemo(() => {
    const commentAuthors = new Set<string>(comments.map((comment) => `@${comment.author.name}`));
    return `${localize('comments.participants')}: ` + [...commentAuthors].join(' ');
  }, [ comments ]);

  const placeholder = React.useMemo(() => {
    return localize('comments.reply.placeholder');
  }, []);

  const startReview = React.useMemo(() => {
    return localize('comments.zone.title');
  }, []);

  return (
    <div className={styles.comment_container}>
      <div className={styles.head}>
        <div className={styles.review_title}>{comments.length > 0 ? commentTitleWithAuthor : startReview}</div>
        <div>
          <div
            onClick={hide}
            className={clx(styles.review_action, expandIconClassName)}
          ></div>
        </div>
      </div>
      <div>
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            mode={comment.mode}
            body={comment.body}
            label={comment.label}
            author={comment.author} />
        ))}
      </div>
      {!readOnly && (
        <div className={clx(styles.comment_reply_container)}>
          <CommentsTextArea
            value={replyText}
            autoFocus={true}
            onFocus={onFocusReply}
            onBlur={onBlurReply}
            onChange={onChangeReply}
            placeholder={`${placeholder}...`}
            rows={rows}
          />
          {(isFocusReply || replyText) && (
            <div className={clx(styles.comment_reply_actions)}>
              <InlineActionBar<ICommentReply>
                separator='inline'
                type='button'
                context={[
                  {
                    text: replyText,
                    thread,
                  },
                ]}
                menus={commentThreadContext}
                afterClick={() => {
                  setReplyText('');
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export class CommentsZoneWidget extends ResizeZoneWidget {
  private _wrapper: HTMLDivElement;
  constructor(protected editor: monaco.editor.ICodeEditor, thread: CommentsThread) {
    super(editor, thread.range);
    this._wrapper = document.createElement('div');
    this._isShow = !thread.isCollapsed;
    this._container.appendChild(this._wrapper);
    this.addDispose(this.observeContainer(this._wrapper));
    ReactDOM.render(
      <ConfigProvider value={thread.appConfig}>
        <CommentsZone thread={thread} hide={() => {
          this.toggle();
        }} />
      </ConfigProvider>,
      this._wrapper,
    );
  }

  get isShow() {
    return this._isShow;
  }

  public toggle() {
    if (this._isShow) {
      this.dispose();
      this._isShow = false;
    } else {
      this.show();
      this._isShow = true;
    }
  }

  protected applyClass(): void {
    // noop
  }

  protected applyStyle(): void {
    // noop
  }
}
