import clx from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';
import ReactDOM from 'react-dom';

import { INJECTOR_TOKEN, Injectable, Autowired } from '@opensumi/di';
import { ConfigProvider, localize, AppConfig, useInjectable, Event, Emitter } from '@opensumi/ide-core-browser';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IEditor } from '@opensumi/ide-editor';
import { ResizeZoneWidget } from '@opensumi/ide-monaco-enhance';

import {
  ICommentReply,
  ICommentsZoneWidget,
  ICommentThreadTitle,
  ICommentsFeatureRegistry,
  ICommentsThread,
} from '../common';

import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { CommentsZoneService } from './comments-zone.service';
import styles from './comments.module.less';

export interface ICommentProps {
  thread: ICommentsThread;
  widget: ICommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = observer(({ thread, widget }) => {
  const { comments, threadHeaderTitle, contextKeyService } = thread;
  const injector = useInjectable(INJECTOR_TOKEN);
  const commentsZoneService: CommentsZoneService = injector.get(CommentsZoneService, [thread]);
  const commentsFeatureRegistry = useInjectable<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  const fileUploadHandler = React.useMemo(() => commentsFeatureRegistry.getFileUploadHandler(), []);
  const [replyText, setReplyText] = React.useState('');
  const commentIsEmptyContext = React.useMemo(
    () => contextKeyService.createKey<boolean>('commentIsEmpty', !replyText),
    [],
  );
  const commentThreadTitle = commentsZoneService.commentThreadTitle;
  const commentThreadContext = commentsZoneService.commentThreadContext;

  const onChangeReply = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { value } = event.target;
    setReplyText(value);
    commentIsEmptyContext.set(!value);
  }, []);

  const placeholder = React.useMemo(
    () =>
      commentsFeatureRegistry.getProviderFeature(thread.providerId)?.placeholder ||
      `${localize('comments.reply.placeholder')}...`,
    [],
  );

  const handleDragFiles = React.useCallback(
    async (files: FileList) => {
      if (fileUploadHandler) {
        const appendText = await fileUploadHandler(replyText, files);
        setReplyText((text) => {
          const value = text + appendText;
          commentIsEmptyContext.set(!value);
          return value;
        });
      }
    },
    [replyText],
  );

  React.useEffect(() => {
    const disposer = widget.onFirstDisplay(() => {
      setTimeout(() => {
        widget.coreEditor.monacoEditor.revealLine(thread.range.startLineNumber + 1);
      }, 0);
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  return (
    <div className={clx(thread.options.threadClassName, styles.comment_container)}>
      <div className={clx(thread.options.threadHeadClassName, styles.head)}>
        <div className={styles.review_title}>{threadHeaderTitle}</div>
        <InlineActionBar<ICommentThreadTitle>
          menus={commentThreadTitle}
          context={[
            {
              thread,
              widget,
              menuId: MenuId.CommentsCommentThreadTitle,
            },
          ]}
          separator='inline'
          type='icon'
        />
      </div>
      <div className={styles.comment_body}>
        {comments.length > 0 ? (
          <CommentItem widget={widget} commentThreadContext={commentThreadContext} thread={thread} />
        ) : (
          <div>
            <CommentsTextArea
              focusDelay={100}
              initialHeight={'auto'}
              value={replyText}
              onChange={onChangeReply}
              placeholder={placeholder}
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
  protected _fillContainer(container: HTMLElement): void {}
  @Autowired(AppConfig)
  appConfig: AppConfig;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  private _wrapper: HTMLDivElement;

  private _editor: IEditor;

  private _onShow = new Emitter<void>();
  public onShow: Event<void> = this._onShow.event;

  private _onHide = new Emitter<void>();
  public onHide: Event<void> = this._onHide.event;

  constructor(editor: IEditor, thread: ICommentsThread) {
    super(editor.monacoEditor, thread.range);
    this._editor = editor;
    this._wrapper = document.createElement('div');
    this._isShow = !thread.isCollapsed;
    this._container.appendChild(this._wrapper);
    this.observeContainer(this._wrapper);
    const customRender = this.commentsFeatureRegistry.getZoneWidgetRender();
    ReactDOM.render(
      <ConfigProvider value={this.appConfig}>
        {customRender ? customRender(thread, this) : <CommentsZone thread={thread} widget={this} />}
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

  public show() {
    super.show();
    this._isShow = true;
    this._onShow.fire();
  }

  public hide() {
    super.dispose();
    this._isShow = false;
    this._onHide.fire();
  }

  public toggle() {
    if (this._isShow) {
      this.hide();
    } else {
      this.show();
    }
  }

  protected applyClass(): void {
    // noop
  }

  protected applyStyle(): void {
    // noop
  }
}
