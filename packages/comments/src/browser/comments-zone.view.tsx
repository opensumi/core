import * as React from 'react';
import { Injectable, Autowired } from '@ali/common-di';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as styles from './comments.module.less';
import { ConfigProvider, localize, AppConfig, useInjectable } from '@ali/ide-core-browser';
import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { ICommentReply, ICommentsZoneWidget, ICommentThreadTitle } from '../common';
import * as clx from 'classnames';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { ResizeZoneWidget } from '@ali/ide-monaco-enhance';
import { CommentsThread } from './comments-thread';
import { IEditor } from '@ali/ide-editor';
import { AbstractMenuService, MenuId } from '@ali/ide-core-browser/lib/menu/next';

export interface ICommentProps {
  thread: CommentsThread;
  widget: CommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, widget }) => {
  const {
    contextKeyService,
    comments,
    threadHeaderTitle,
  } = thread;
  const [replyText, setReplyText] = React.useState('');
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);
  const commentIsEmptyContext = React.useMemo(() => {
    return contextKeyService.createKey('commentIsEmpty', !replyText);
  }, []);
  const commentThreadTitle = React.useMemo(() => {
    return menuService.createMenu(
      MenuId.CommentsCommentThreadTitle,
      contextKeyService,
    );
  }, []);
  const commentThreadContext = React.useMemo(() => {
    return menuService.createMenu(
      MenuId.CommentsCommentThreadContext,
      contextKeyService,
    );
  }, []);

  function onChangeReply(event: React.ChangeEvent<HTMLTextAreaElement>) {
    commentIsEmptyContext.set(!event.target.value);
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
          type='icon'/>
      </div>
      <div className={styles.comment_body}>
      { comments.length > 0 ?
        <CommentItem commentThreadContext={commentThreadContext} thread={thread} /> : (
        <div>
          <CommentsTextArea
            focusDelay={100}
            value={replyText}
            onChange={onChangeReply}
            placeholder={`${localize('comments.reply.placeholder')}...`}
          />
          <div className={styles.comment_bottom_actions}>
            <InlineActionBar<ICommentReply>
              className={styles.comment_reply_actions}
              type='button'
              context={[
                {
                  text: replyText,
                  thread,
                },
              ]}
              menus={commentThreadContext}
            />
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
