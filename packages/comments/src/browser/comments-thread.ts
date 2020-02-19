import { Injectable, Autowired } from '@ali/common-di';
import { observable } from 'mobx';
import {
  IRange,
  Disposable,
  URI,
  IContextKeyService,
  AppConfig,
  uuid,
} from '@ali/ide-core-browser';
import { CommentsZoneWidget } from './comments-zone.view';
import { ICommentsThread, IComment, ICommentsThreadOptions, CommentMode, ICommentAuthorInformation, IThreadComment } from '../common';
import {
  MenuId,
  AbstractMenuService,
  IMenu,
} from '@ali/ide-core-browser/lib/menu/next';
import { IEditor, EditorCollectionService } from '@ali/ide-editor';

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

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

  @Autowired(EditorCollectionService)
  editorCollectionService: EditorCollectionService;

  @Autowired(AppConfig)
  public readonly appConfig: AppConfig;

  @observable
  public comments: IThreadComment[];

  private widgets = new Map<IEditor, CommentsZoneWidget>();
  private _commentThreadContext: IMenu;
  private _commentTitle: IMenu;
  private _commentContext: IMenu;
  private _commentThreadTitle: IMenu;

  private _readOnly: boolean;
  private _isCollapsed: boolean;

  private _data?: any;

  static getId(uri: URI, range: IRange): string {
    return `${uri}#${range.startLineNumber}`;
  }

  constructor(
    public uri: URI,
    public range: IRange,
    public options: ICommentsThreadOptions,
  ) {
    super();
    this._readOnly = !!options.readOnly;
    this._isCollapsed = !!options.isCollapsed;
    this.comments = options.comments ? options.comments.map((comment) => new Comment(comment)) : [];
    this._data = options.data;
    this.initMenuContext();
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
    return this._readOnly;
  }

  get isCollapsed() {
    return this._isCollapsed;
  }

  get data() {
    return this._data;
  }

  private getEditorsByUri(uri: URI): IEditor[] {
    return this.editorCollectionService.listEditors()
      .filter((editor) => editor.currentUri?.isEqual(uri));
  }

  private initMenuContext() {
    this._commentThreadContext = this.menuService.createMenu(
      MenuId.CommentsCommentThreadContext,
      this.contextKeyService,
    );
    this._commentTitle = this.menuService.createMenu(
      MenuId.CommentsCommentTitle,
      this.contextKeyService,
    );
    this._commentContext = this.menuService.createMenu(
      MenuId.CommentsCommentContext,
      this.contextKeyService,
    );
    this._commentThreadTitle = this.menuService.createMenu(
      MenuId.CommentsCommentThreadTitle,
      this.contextKeyService,
    );
    this.addDispose(this._commentThreadContext);
    this.addDispose(this._commentTitle);
    this.addDispose(this._commentContext);
    this.addDispose(this._commentThreadTitle);
  }

  private addWidgetByEditor(editor: IEditor) {
    const widget = new CommentsZoneWidget(editor.monacoEditor, this);
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
