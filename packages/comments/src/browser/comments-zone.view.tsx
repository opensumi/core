import * as React from 'react';
import { Injectable, Autowired } from '@ali/common-di';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as styles from './comments.module.less';
import { ConfigProvider, localize, AppConfig } from '@ali/ide-core-browser';
import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { ICommentReply, ICommentsZoneWidget, ICommentThreadTitle } from '../common';
import * as clx from 'classnames';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { ResizeZoneWidget } from '@ali/ide-monaco-enhance';
import { CommentsThread } from './comments-thread';
import { IEditor } from '@ali/ide-editor';

export interface ICommentProps {
  thread: CommentsThread;
  widget: CommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, widget }) => {
  const {
    commentThreadTitle,
    commentThreadContext,
    contextKeyService,
    comments,
    threadHeaderTitle,
  } = thread;
  const [showReply, setShowReply] = React.useState(true);
  const textRef = React.useRef<HTMLTextAreaElement>(null);
  const [replyText, setReplyText] = React.useState('');
  const commentIsEmptyContext = React.useRef(contextKeyService.createKey('commentIsEmpty', !replyText));

  React.useEffect(() => {
    if (showReply) {
      // FIXME 立马执行 focus 会无效
      setTimeout(() => {
        textRef?.current?.focus();
      }, 200);
    }
  }, [showReply]);

  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    commentIsEmptyContext.current.set(!event.target.value);
    setReplyText(event.target.value);
  }

  return (
    <div className={clx(thread.options.threadClassName, styles.comment_container)}>
      <div className={clx(thread.options.threadHeadClassName, styles.head)}>
        <div className={styles.review_title}>{threadHeaderTitle}</div>
        <InlineActionBar<ICommentThreadTitle>
          menus={commentThreadTitle}
          context={[{
            thread,
            widget,
          }]}
          separator='inline'
          type='icon'
          afterClick={() => {
            // console.log('thread', thread);
          }}
          />
      </div>
      <div className={styles.comment_body}>
      { comments.length > 0 ?
        <CommentItem thread={thread} /> : (
        <div>
          <CommentsTextArea
            ref={textRef}
            value={replyText}
            onChange={onChangeReply}
            placeholder={`${localize('comments.reply.placeholder')}...`}
          />
          <div className={styles.comment_bottom_actions}>
            <InlineActionBar<ICommentReply>
              className={styles.comment_reply_actions}
              separator='inline'
              type='secondary'
              context={[
                {
                  text: replyText,
                  thread,
                },
              ]}
              menus={commentThreadContext}
              afterClick={() => {
                setReplyText('');
                setShowReply(false);
              }}/>
          </div>
        </div>
      )}
      </div>
    </div>
  );
});

@Injectable({ multiple: true })
export class CommentsZoneWidget extends ResizeZoneWidget implements ICommentsZoneWidget {

  @Autowired(AppConfig)
  appConfig: AppConfig;

  private _wrapper: HTMLDivElement;

  constructor(protected editor: monaco.editor.ICodeEditor, thread: CommentsThread, public readonly coreEditor: IEditor) {
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
