import * as React from 'react';
import { Injectable, Autowired } from '@ali/common-di';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as styles from './comments.module.less';
import { ConfigProvider, localize, AppConfig } from '@ali/ide-core-browser';
import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { ICommentReply } from '../common';
import * as clx from 'classnames';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { ResizeZoneWidget } from '@ali/ide-monaco-enhance';
import { CommentsThread } from './comments-thread';

export interface ICommentProps {
  thread: CommentsThread;
  widget: CommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, widget }) => {
  const { commentThreadTitle, commentThreadContext, readOnly, comments } = thread;
  const [isFocusReply] = React.useState(true);
  const [rows] = React.useState(5);
  const [replyText, setReplyText] = React.useState('');

  function onBlurReply(event: React.FocusEvent<HTMLTextAreaElement>) {
    // TODO: 和 ResizeZone Widget 配合使用会抖动，先注释掉
    // setFocusReply(false);
    // if (replyText === '') {
    //   setRows(1);
    // }
  }

  function onFocusReply(event: React.FocusEvent<HTMLTextAreaElement>) {
    // setFocusReply(true);
    // if (replyText === '') {
    //   setRows(5);
    // }
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
    <div className={clx(thread.options.threadClassName, styles.comment_container)}>
      <div className={clx(thread.options.threadHeadClassName, styles.head)}>
        <div className={styles.review_title}>{comments.length > 0 ? commentTitleWithAuthor : startReview}</div>
        <InlineActionBar
          menus={commentThreadTitle}
          context={[thread, widget]}
          separator='inline'
          type='icon'
          />
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

@Injectable({ multiple: true })
export class CommentsZoneWidget extends ResizeZoneWidget {

  @Autowired(AppConfig)
  appConfig: AppConfig;

  private _wrapper: HTMLDivElement;

  constructor(protected editor: monaco.editor.ICodeEditor, thread: CommentsThread) {
    super(editor, thread.range);
    this._wrapper = document.createElement('div');
    this._isShow = !thread.isCollapsed;
    this._container.appendChild(this._wrapper);
    this.addDispose(this.observeContainer(this._wrapper));
    ReactDOM.render(
      <ConfigProvider value={this.appConfig}>
        <CommentsZone thread={thread} widget={this} />
      </ConfigProvider>,
      this._wrapper,
    );
  }

  get currentEditor() {
    return this.editor;
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
