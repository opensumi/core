import cls from 'classnames';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { Autowired, INJECTOR_TOKEN, Injectable } from '@opensumi/di';
import {
  AppConfig,
  ConfigProvider,
  Emitter,
  Event,
  localize,
  useAutorun,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IEditor } from '@opensumi/ide-editor';
import { IOptions, ResizeZoneWidget } from '@opensumi/ide-monaco-enhance';

import {
  ICommentReply,
  ICommentThreadTitle,
  ICommentsFeatureRegistry,
  ICommentsThread,
  ICommentsZoneWidget,
} from '../common';

import { CommentItem } from './comments-item.view';
import { CommentsTextArea } from './comments-textarea.view';
import { CommentsZoneService } from './comments-zone.service';
import styles from './comments.module.less';

export interface ICommentProps {
  thread: ICommentsThread;
  widget: ICommentsZoneWidget;
}

const CommentsZone: React.FC<ICommentProps> = ({ thread, widget }) => {
  const { contextKeyService } = thread;
  const comments = useAutorun(thread.comments);
  const threadHeaderTitle = useAutorun(thread.threadHeaderTitle);

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
        widget.coreEditor.monacoEditor.revealLine(thread.range.endLineNumber + 1);
      }, 0);
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  const handleMouseOver = React.useCallback(() => {
    commentsZoneService.setCurrentCommentThread(commentsZoneService.thread);
  }, []);

  const handleMouseOut = React.useCallback(() => {
    commentsZoneService.setCurrentCommentThread(undefined);
  }, []);

  const handleFocus = React.useCallback(() => {
    commentsZoneService.setCurrentCommentThread(commentsZoneService.thread);
  }, []);

  const handleBlur = React.useCallback(() => {
    commentsZoneService.setCurrentCommentThread(undefined);
  }, []);

  return (
    <div
      tabIndex={-1}
      onMouseOver={handleMouseOver}
      onMouseOut={handleMouseOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={cls(thread.options.threadClassName, styles.comment_container)}
    >
      <div className={cls(thread.options.threadHeadClassName, styles.head)}>
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
};

@Injectable({ multiple: true })
export class CommentsZoneWidget extends ResizeZoneWidget implements ICommentsZoneWidget {
  protected _fillContainer(): void {}
  @Autowired(AppConfig)
  appConfig: AppConfig;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  private wrapperRoot: ReactDOM.Root | undefined;

  private _editor: IEditor;

  private _onShow = new Emitter<void>();
  public onShow: Event<void> = this._onShow.event;

  private _onHide = new Emitter<void>();
  public onHide: Event<void> = this._onHide.event;

  constructor(editor: IEditor, public readonly thread: ICommentsThread, options?: IOptions) {
    super(editor.monacoEditor, thread.range, {
      ...options,
      showInHiddenAreas: true,
    });
    this._editor = editor;

    this._isShow = !thread.isCollapsed.get();

    const _wrapper = document.createElement('div');
    this._container.appendChild(_wrapper);
    this.observeContainer(_wrapper);
    const customRender = this.commentsFeatureRegistry.getZoneWidgetRender();

    this.wrapperRoot = ReactDOM.createRoot(_wrapper);
    this.wrapperRoot.render(
      <ConfigProvider value={this.appConfig}>
        {customRender ? customRender(this.thread, this) : <CommentsZone thread={this.thread} widget={this} />}
      </ConfigProvider>,
    );

    this.addDispose({
      dispose: () => {
        this.wrapperRoot?.unmount();
        this.wrapperRoot = undefined;
      },
    });
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
    super.hide();
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
