import { observable, computed, autorun } from 'mobx';

import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IRange, Disposable, URI, IContextKeyService, uuid, localize } from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { IEditor, EditorCollectionService } from '@opensumi/ide-editor';

import {
  ICommentsThread,
  IComment,
  ICommentsThreadOptions,
  ICommentsService,
  IThreadComment,
  ICommentsZoneWidget,
} from '../common';

import { CommentsZoneWidget } from './comments-zone.view';


@Injectable({ multiple: true })
export class CommentsThread extends Disposable implements ICommentsThread {
  @Autowired(ICommentsService)
  commentsService: ICommentsService;

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private readonly _contextKeyService: IContextKeyService;

  @Autowired(EditorCollectionService)
  private readonly editorCollectionService: EditorCollectionService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @observable
  public comments: IThreadComment[];

  @observable
  public label: string | undefined;

  public data: any;

  set contextValue(value: string | undefined) {
    this._contextKeyService.createKey<string>('thread', value);
  }

  get contextValue() {
    return this._contextKeyService.getContextValue('thread');
  }

  private widgets = new Map<IEditor, CommentsZoneWidget>();

  private _id = `thread_${uuid()}`;

  @observable
  private _readOnly = false;

  @observable
  public isCollapsed: boolean;

  constructor(
    public uri: URI,
    public range: IRange,
    public providerId: string,
    public options: ICommentsThreadOptions,
  ) {
    super();
    this.comments = options.comments
      ? options.comments.map((comment) => ({
          ...comment,
          id: uuid(),
        }))
      : [];
    this.data = this.options.data;
    this._contextKeyService = this.registerDispose(this.globalContextKeyService.createScoped());
    // 设置 resource context key
    const resourceContext = new ResourceContextKey(this._contextKeyService);
    resourceContext.set(uri);
    this._contextKeyService.createKey<string>('thread', options.contextValue);
    this.readOnly = !!options.readOnly;
    this.label = options.label;
    this.isCollapsed = !!this.options.isCollapsed;
    const threadsLengthContext = this._contextKeyService.createKey<number>(
      'threadsLength',
      this.commentsService.getThreadsByUri(uri).length,
    );
    const commentsLengthContext = this._contextKeyService.createKey<number>('commentsLength', this.comments.length);
    // vscode 用于判断 thread 是否为空
    const commentThreadIsEmptyContext = this._contextKeyService.createKey<boolean>(
      'commentThreadIsEmpty',
      !this.comments.length,
    );
    // vscode 用于判断是否为当前 controller 注册
    this._contextKeyService.createKey<string>('commentController', providerId);
    // 监听 comments 的变化
    autorun(() => {
      commentsLengthContext.set(this.comments.length);
      commentThreadIsEmptyContext.set(!this.comments.length);
    });
    autorun(() => {
      if (this.isCollapsed) {
        this.hideAll();
      } else {
        this.showAll();
      }
    });
    // 监听每次 thread 的变化，重新设置 threadsLength
    this.addDispose(
      this.commentsService.onThreadsChanged((thread) => {
        if (thread.uri.isEqual(uri)) {
          threadsLengthContext.set(this.commentsService.getThreadsByUri(uri).length);
        }
      }),
    );
    this.addDispose({
      dispose: () => {
        this.comments = [];
      },
    });
  }
  getWidgetByEditor(editor: IEditor): ICommentsZoneWidget | undefined {
    return this.widgets.get(editor);
  }

  get id() {
    return this._id;
  }

  get contextKeyService() {
    return this._contextKeyService;
  }

  @computed
  get readOnly() {
    return this._readOnly;
  }

  set readOnly(readOnly: boolean) {
    this._readOnly = readOnly;
    this._contextKeyService.createKey<boolean>('readOnly', this._readOnly);
  }

  @computed
  get threadHeaderTitle() {
    if (this.label) {
      return this.label;
    }
    if (this.comments.length) {
      const commentAuthors = new Set<string>(this.comments.map((comment) => `@${comment.author.name}`));
      return `${localize('comments.participants')}: ` + [...commentAuthors].join(' ');
    } else {
      return localize('comments.zone.title');
    }
  }

  private getEditorsByUri(uri: URI): IEditor[] {
    return this.editorCollectionService.listEditors().filter((editor) => editor.currentUri?.isEqual(uri));
  }

  private addWidgetByEditor(editor: IEditor) {
    const widget = this.injector.get(CommentsZoneWidget, [editor, this]);
    // 如果当前 widget 发生高度变化，通知同一个 同一个 editor 的其他 range 相同的 thread 也重新计算一下高度
    this.addDispose(
      widget.onChangeZoneWidget(() => {
        const threads = this.commentsService.commentsThreads.filter((thread) => this.isEqual(thread));
        // 只需要 resize 当前 thread 之后的 thread
        const currentIndex = threads.findIndex((thread) => thread === this);
        const resizeThreads = threads.slice(currentIndex + 1);
        for (const thread of resizeThreads) {
          if (thread.isShowWidget(editor)) {
            const widget = thread.getWidgetByEditor(editor);
            widget?.resize();
          }
        }
      }),
    );
    this.addDispose(widget);
    this.widgets.set(editor, widget);
    editor.onDispose(() => {
      widget.dispose();
      this.widgets.delete(editor);
    });
    return widget;
  }

  public toggle = (editor: IEditor) => {
    if (this.comments.length > 0) {
      const widget = this.widgets.get(editor);
      if (widget) {
        widget.toggle();
      }
    } else {
      this.dispose();
    }
  };

  public show(editor?: IEditor) {
    if (editor) {
      let widget = this.widgets.get(editor);
      // 说明是在新的 group 中打开
      if (!widget) {
        widget = this.addWidgetByEditor(editor);
      }
      widget.show();
    } else {
      // 每次都拿所有的有这个 uri 的 editor
      const editors = this.getEditorsByUri(this.uri);
      editors.forEach((editor) => {
        let widget = this.widgets.get(editor);
        // 说明是在新的 group 中打开
        if (!widget) {
          widget = this.addWidgetByEditor(editor);
        }
        // 如果标记之前是已经展示的 widget，则调用 show 方法
        if (editor.currentUri?.isEqual(this.uri)) {
          widget.show();
        }
      });
    }
  }

  public showWidgetsIfShowed() {
    for (const editor of this.getEditorsByUri(this.uri)) {
      let widget = this.widgets.get(editor);
      // 说明是在新的 group 中打开
      if (!widget) {
        widget = this.addWidgetByEditor(editor);
      }
      // 如果标记之前是已经展示的 widget，则调用 show 方法
      if (editor.currentUri?.isEqual(this.uri) && widget.isShow) {
        widget.show();
      }
    }
  }

  public hideWidgetsByDispose(): void {
    for (const [editor, widget] of this.widgets) {
      !editor.currentUri?.isEqual(this.uri) && widget.dispose();
    }
  }

  public isShowWidget(editor?: IEditor) {
    if (editor) {
      const widget = this.widgets.get(editor);
      return widget ? widget.isShow : false;
    } else {
      for (const [, widget] of this.widgets) {
        return widget.isShow;
      }
      return false;
    }
  }

  public hide(editor?: IEditor) {
    if (editor) {
      const widget = this.widgets.get(editor);
      widget?.hide();
    } else {
      this.hideAll();
    }
  }

  public showAll() {
    for (const [, widget] of this.widgets) {
      widget.show();
    }
  }

  public hideAll(isDospose?: boolean) {
    for (const [editor, widget] of this.widgets) {
      if (isDospose) {
        // 如果 thread 出现在当前 editor 则不隐藏
        !editor.currentUri?.isEqual(this.uri) && widget.dispose();
      } else {
        widget.hide();
      }
    }
  }

  public addComment(...comments: IComment[]) {
    this.comments.push(
      ...comments.map((comment) => ({
        ...comment,
        id: uuid(),
      })),
    );
  }

  public removeComment(comment: IComment) {
    const index = this.comments.findIndex((c) => c === comment);
    if (index !== -1) {
      this.comments.splice(index, 1);
    }
  }

  public isEqual(thread: ICommentsThread): boolean {
    return thread.uri.isEqual(this.uri) && thread.range.startLineNumber === this.range.startLineNumber;
  }
}
