import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, computed, autorun } from 'mobx';
import {
  IRange,
  Disposable,
  URI,
  IContextKeyService,
  uuid,
  localize,
} from '@ali/ide-core-browser';
import { CommentsZoneWidget } from './comments-zone.view';
import { ICommentsThread, IComment, ICommentsThreadOptions, ICommentsService, IThreadComment } from '../common';
import { IEditor, EditorCollectionService } from '@ali/ide-editor';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';

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

  private widgets = new Map<IEditor, CommentsZoneWidget>();

  static getId(uri: URI, range: IRange): string {
    return `${uri}#${range.startLineNumber}`;
  }

  constructor(
    public uri: URI,
    public range: IRange,
    public options: ICommentsThreadOptions,
  ) {
    super();
    this.comments = options.comments ? options.comments.map((comment) => ({
      ...comment,
      id: uuid(),
    })) : [];

    this._contextKeyService = this.registerDispose(this.globalContextKeyService.createScoped());
    // 设置 resource context key
    const resourceContext = new ResourceContextKey(this._contextKeyService);
    resourceContext.set(uri);
    options.contextValue && this._contextKeyService.createKey<string>('thread', options.contextValue);
    this._contextKeyService.createKey<boolean>('readOnly', !!options.readOnly);
    const threadsLengthContext = this._contextKeyService.createKey<number>('threadsLength', this.commentsService.getThreadsByUri(uri).length);
    const commentsLengthContext = this._contextKeyService.createKey<number>('commentsLength', this.comments.length);
    // 监听 comments 的变化
    autorun(() => {
      commentsLengthContext.set(this.comments.length);
    });
    // 监听每次 thread 的变化，重新设置 threadsLength
    this.commentsService.onThreadsChanged((thread) => {
      if (thread.uri.isEqual(uri)) {
        threadsLengthContext.set(this.commentsService.getThreadsByUri(uri).length);
      }
    });
    this.addDispose({
      dispose: () => {
        this.comments = [];
      },
    });
  }

  get id() {
    return CommentsThread.getId(this.uri, this.range);
  }

  get contextKeyService() {
    return this._contextKeyService;
  }

  get readOnly() {
    return !!this.options.readOnly;
  }

  get isCollapsed() {
    return !!this.options.isCollapsed;
  }

  get data() {
    return this.options.data;
  }

  @computed
  get threadHeaderTitle() {
    if (this.comments.length) {
      const commentAuthors = new Set<string>(this.comments.map((comment) => `@${comment.author.name}`));
      return `${localize('comments.participants')}: ` + [...commentAuthors].join(' ');
    } else {
      return localize('comments.zone.title');
    }

  }

  private getEditorsByUri(uri: URI): IEditor[] {
    return this.editorCollectionService.listEditors()
      .filter((editor) => editor.currentUri?.isEqual(uri));
  }

  private addWidgetByEditor(editor: IEditor) {
    const widget = this.injector.get(CommentsZoneWidget, [editor.monacoEditor, this, editor]);
    this.widgets.set(editor, widget);
    this.addDispose(widget);
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
  }

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
        if (editor.currentUri?.isEqual(this.uri) && widget.isShow) {
          widget.show();
        }
      });
    }
  }

  public hide() {
    for (const [editor, widget] of this.widgets) {
      if (!editor.currentUri?.isEqual(this.uri) && widget.isShow) {
        widget.dispose();
      }
    }
  }

  public showAll() {
    for (const [, widget] of this.widgets) {
      if (!widget.isShow) {
        widget.toggle();
      }
    }
  }

  public hideAll() {
    for (const [, widget] of this.widgets) {
      if (widget.isShow) {
        widget.toggle();
      }
    }
  }

  public addComment(...comments: IComment[]) {
    this.comments.push(...comments.map((comment) => ({
      ...comment,
      id: uuid(),
    })));
  }

  public removeComment(comment: IComment) {
    const index = this.comments.findIndex((c) => c === comment );
    if (index !== -1) {
      this.comments.splice(index, 1);
    }
  }
}
