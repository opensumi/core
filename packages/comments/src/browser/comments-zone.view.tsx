import * as React from 'react';
import { INJECTOR_TOKEN, Injectable, Autowired } from '@ali/common-di';
import * as ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import * as styles from './comments.module.less';
import { ConfigProvider, localize, AppConfig, useInjectable } from '@ali/ide-core-browser';
import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { ICommentReply, ICommentsZoneWidget, ICommentThreadTitle, ICommentsFeatureRegistry } from '../common';
import * as clx from 'classnames';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import { ResizeZoneWidget } from '@ali/ide-monaco-enhance';
import { CommentsThread } from './comments-thread';
import { IEditor } from '@ali/ide-editor';
import { CommentsZoneService } from './comments-zone.service';
import { MenuId } from '@ali/ide-core-browser/lib/menu/next';

export interface ICommentProps {
  thread: CommentsThread;
  widget: CommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, widget }) => {
  const {
    comments,
    threadHeaderTitle,
    contextKeyService,
  } = thread;
  const injector = useInjectable(INJECTOR_TOKEN);
  const commentsZoneService: CommentsZoneService = injector.get(CommentsZoneService, [ thread ]);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);
  const [replyText, setReplyText] = React.useState('');
  const commentIsEmptyContext = React.useMemo(() => {
    return contextKeyService.createKey<boolean>('commentIsEmpty', !replyText);
  }, []);
  const commentThreadTitle = commentsZoneService.commentThreadTitle;
  const commentThreadContext = commentsZoneService.commentThreadContext;

  const onChangeReply = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setReplyText(value);
    commentIsEmptyContext.set(!value);
  }, []);

  const handleDragFiles = React.useCallback(async (files: FileList) => {
    if (fileUploadHandler) {
      const appendText = await fileUploadHandler(replyText, files);
      setReplyText((text) => {
        const value = text + appendText;
        commentIsEmptyContext.set(!value);
        return value;
      });
    }
  }, [ replyText ]);

  return (
    <div className={clx(thread.options.threadClassName, styles.comment_container)}>
      <div className={clx(thread.options.threadHeadClassName, styles.head)}>
        <div className={styles.review_title}>{threadHeaderTitle}</div>
        <InlineActionBar<ICommentThreadTitle>
          menus={commentThreadTitle}
          context={[{
            thread,
            widget,
            menuId: MenuId.CommentsCommentThreadTitle,
          }]}
          separator='inline'
          type='icon'/>
      </div>
      <div className={styles.comment_body}>
      { comments.length > 0 ?
        <CommentItem widget={widget} commentThreadContext={commentThreadContext} thread={thread} /> : (
        <div>
          <CommentsTextArea
            focusDelay={100}
            initialHeight={'auto'}
            value={replyText}
            onChange={onChangeReply}
            placeholder={`${localize('comments.reply.placeholder')}...`}
            dragFiles={handleDragFiles}
          />
          <div className={styles.comment_bottom_actions}>
            <InlineActionBar<ICommentReply>
              className={styles.comment_reply_actions}
              separator='inline'
              type='button'
              context={[
                {
                  text: replyText,
                  widget,
                  thread,
                  menuId: MenuId.CommentsCommentThreadContext,
                },
              ]}
              menus={commentThreadContext}
              afterClick={() => {
                setReplyText('');
                commentIsEmptyContext.set(true);
              }}
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

  private _editor: IEditor;

  constructor(editor: IEditor, thread: CommentsThread) {
    super(editor.monacoEditor, thread.range);
    this._editor = editor;
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

  get coreEditor() {
    return this._editor;
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
