import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable } from 'mobx';
import {
  IRange,
  Disposable,
  URI,
  IContextKeyService,
  uuid,
} from '@ali/ide-core-browser';
import { CommentsZoneWidget } from './comments-zone.view';
import { ICommentsThread, IComment, ICommentsThreadOptions, CommentMode, ICommentAuthorInformation, IThreadComment, ICommentsService } from '../common';
import {
  MenuId,
  AbstractMenuService,
  IMenu,
} from '@ali/ide-core-browser/lib/menu/next';
import { IEditor, EditorCollectionService } from '@ali/ide-editor';
import { ResourceContextKey } from '@ali/ide-core-browser/lib/contextkey/resource';

export class Comment implements IThreadComment {
  private options: IComment;
  private _id: string;
  constructor(options: IComment) {
    this.options = options;
    this._id = uuid();
  }

  get id() {
    return this._id;
  }

  get mode() {
    return this.options.mode;
  }

  get body() {
    return this.options.body;
  }

  get author() {
    return this.options.author;
  }

  get label() {
    return this.options.label;
  }

  get data() {
    return this.options.data;
  }
}

@Injectable({ multiple: true })
export class CommentsThread extends Disposable implements ICommentsThread {

  @Autowired(AbstractMenuService)
  private readonly menuService: AbstractMenuService;

  @Autowired(ICommentsService)
  commentsService: ICommentsService;

  @Autowired(IContextKeyService)
  private readonly globalContextKeyService: IContextKeyService;

  private readonly contextKeyService: IContextKeyService;

  @Autowired(EditorCollectionService)
  editorCollectionService: EditorCollectionService;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @observable
  public comments: IThreadComment[];

  private widgets = new Map<IEditor, CommentsZoneWidget>();
  private _commentThreadContext: IMenu;
  private _commentTitle: IMenu;
  private _commentContext: IMenu;
  private _commentThreadTitle: IMenu;

  static getId(uri: URI, range: IRange): string {
    return `${uri}#${range.startLineNumber}`;
  }

  constructor(
    public uri: URI,
    public range: IRange,
    public options: ICommentsThreadOptions,
  ) {
    super();
    this.comments = options.comments ? options.comments.map((comment) => new Comment(comment)) : [];
    this.contextKeyService = this.registerDispose(this.globalContextKeyService.createScoped());
    // 设置 resource context key
    const resourceContext = new ResourceContextKey(this.contextKeyService);
    resourceContext.set(uri);
    this.initMenuContext();
    const threadsLengthContext = this.contextKeyService.createKey<number>('threadsLength', this.commentsService.getThreadsByUri(uri).length);
    // 监听每次 thread 的变化，重新设置 threadsLength
    this.commentsService.onThreadsChanged(() => {
      threadsLengthContext.set(this.commentsService.getThreadsByUri(uri).length);
    });
  }

  get id() {
    return CommentsThread.getId(this.uri, this.range);
  }

  get commentThreadContext() {
    return this._commentThreadContext;
  }

  get commentTitle() {
    return this._commentTitle;
  }

  get commentContext() {
    return this._commentContext;
  }

  get commentThreadTitle() {
    return this._commentThreadTitle;
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

  private getEditorsByUri(uri: URI): IEditor[] {
    return this.editorCollectionService.listEditors()
      .filter((editor) => editor.currentUri?.isEqual(uri));
  }

  private initMenuContext() {
    this._commentThreadContext = this.registerDispose(this.menuService.createMenu(
      MenuId.CommentsCommentThreadContext,
      this.contextKeyService,
    ));
    this._commentTitle = this.registerDispose(this.menuService.createMenu(
      MenuId.CommentsCommentTitle,
      this.contextKeyService,
    ));
    this._commentContext = this.registerDispose(this.menuService.createMenu(
      MenuId.CommentsCommentContext,
      this.contextKeyService,
    ));
    this._commentThreadTitle = this.registerDispose(this.menuService.createMenu(
      MenuId.CommentsCommentThreadTitle,
      this.contextKeyService,
    ));
  }

  private addWidgetByEditor(editor: IEditor) {
    const widget = this.injector.get(CommentsZoneWidget, [editor.monacoEditor, this]);
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

  public show() {
    // 每次都拿所有的有这个 uri 的 editor
    const editors = this.getEditorsByUri(this.uri);
    editors.forEach((editor) => {
      let widget = this.widgets.get(editor);
      // 说明是在新的 group 中打开
      if (!widget) {
        widget = this.addWidgetByEditor(editor);
      }
      if (editor.currentUri?.isEqual(this.uri) && widget.isShow) {
        widget.show();
      }
    });
  }

  public hide() {
    for (const [editor, widget] of this.widgets) {
      if (!editor.currentUri?.isEqual(this.uri) && widget.isShow) {
        widget.dispose();
      }
    }
  }

  public addComment(...comments: IComment[]) {
    this.comments.push(...comments.map((comment) => new Comment(comment)));
  }
}
