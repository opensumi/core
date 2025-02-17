import flattenDeep from 'lodash/flattenDeep';
import groupBy from 'lodash/groupBy';

import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  AppConfig,
  Deferred,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  IRange,
  LRUCache,
  LabelService,
  URI,
  formatLocalize,
  getIcon,
  localize,
  memoize,
} from '@opensumi/ide-core-browser';
import { IEditor } from '@opensumi/ide-editor';
import {
  IEditorDecorationCollectionService,
  IEditorDocumentModelService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { positionToRange } from '@opensumi/ide-monaco';
import * as monaco from '@opensumi/ide-monaco';
import { monacoBrowser } from '@opensumi/ide-monaco/lib/browser';
import { IIconService, IconType } from '@opensumi/ide-theme';
import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';

import {
  CommentPanelId,
  CommentThreadCollapsibleState,
  ICommentRangeProvider,
  ICommentsFeatureRegistry,
  ICommentsService,
  ICommentsThread,
  ICommentsThreadOptions,
  IWriteableCommentsTreeNode,
} from '../common';

import { CommentsPanel } from './comments-panel.view';
import { CommentsThread } from './comments-thread';
import { CommentContentNode, CommentFileNode, CommentReplyNode, CommentRoot } from './tree/tree-node.defined';

@Injectable()
export class CommentsService extends Disposable implements ICommentsService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(IEditorDecorationCollectionService)
  private readonly editorDecorationCollectionService: IEditorDecorationCollectionService;

  @Autowired(IIconService)
  private readonly iconService: IIconService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(IEditorDocumentModelService)
  private readonly documentService: IEditorDocumentModelService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

  @Autowired(ResourceService)
  private readonly resourceService: ResourceService;

  private decorationChangeEmitter = new Emitter<URI>();

  private threads = new Map<string, ICommentsThread>();

  private threadsChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCommentChangeEmitter = new Emitter<ICommentsThread>();

  private commentRangeProviderChangeEmitter = new Emitter<void>();
  private onDidChangeCurrentCommentThreadEmitter = new Emitter<ICommentsThread | undefined>();

  private threadsCreatedEmitter = new Emitter<ICommentsThread>();

  private rangeProviderMap = new Map<string, ICommentRangeProvider>();

  private rangeOwner = new Map<string, IRange[]>();

  private providerDecorationCache = new LRUCache<string, Deferred<IRange[]>>(10000);

  private commentRangeDecorationMap: Map<string, string[]> = new Map();

  // 默认在 file 协议和 git 协议中显示评论数据
  private shouldShowCommentsSchemes = new Set(['file', 'git', 'diff']);

  private decorationProviderDisposer = Disposable.NULL;

  get commentsThreads() {
    return [...this.threads.values()];
  }

  @memoize
  get isMultiCommentsForSingleLine() {
    return !!this.commentsFeatureRegistry.getConfig()?.isMultiCommentsForSingleLine;
  }

  @memoize
  get currentAuthorAvatar() {
    return this.commentsFeatureRegistry.getConfig()?.author?.avatar;
  }

  @memoize
  get filterThreadDecoration() {
    return this.commentsFeatureRegistry.getConfig()?.filterThreadDecoration;
  }

  get onThreadsChanged(): Event<ICommentsThread> {
    return this.threadsChangeEmitter.event;
  }

  get onThreadsCommentChange(): Event<ICommentsThread> {
    return this.threadsCommentChangeEmitter.event;
  }

  get onThreadsCreated(): Event<ICommentsThread> {
    return this.threadsCreatedEmitter.event;
  }

  get onCommentRangeProviderChange() {
    return this.commentRangeProviderChangeEmitter.event;
  }

  get onDidChangeCurrentCommentThread() {
    return this.onDidChangeCurrentCommentThreadEmitter.event;
  }

  public setCurrentCommentThread(thread: ICommentsThread) {
    this.onDidChangeCurrentCommentThreadEmitter.fire(thread);
  }

  /**
   * -------------------------------- IMPORTANT --------------------------------
   * 需要注意区分 model.IModelDecorationOptions 与 monaco.editor.IModelDecorationOptions 两个类型
   * 将 model.IModelDecorationOptions 类型的对象传给签名为 monaco.editor.IModelDecorationOptions 的方法时需要做 Type Assertion
   * 这是因为 monaco.d.ts 与 vs/editor/common/model 分别导出了枚举 TrackedRangeStickiness
   * 这种情况下两个枚举的类型是不兼容的，即使他们是同一段代码的编译产物
   * -------------------------------- IMPORTANT --------------------------------
   * @param thread
   */
  private createThreadDecoration(thread: ICommentsThread): model.IModelDecorationOptions {
    // 对于新增的空的 thread，默认显示当前用户的头像，否则使用第一个用户的头像
    const comments = thread.comments.get();
    const avatar = comments.length === 0 ? this.currentAuthorAvatar : comments[0].author.iconPath?.toString();
    const icon = avatar
      ? `${this.iconService.fromIcon('', avatar, IconType.Background)} avatar-icon`
      : this.iconService.fromString('$(comment)');
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-thread-decoration',
      glyphMarginClassName: avatar
        ? ['comment-thread', icon].join(' ')
        : ['comment-range', 'comment-thread', icon].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private currentThreadCollapseStateListener: IDisposable | undefined;
  private activeThreadDecorationIds: string[] = [];

  private updateActiveThreadDecoration(thread?: ICommentsThread) {
    const editor = this.getCurrentEditor(thread?.uri);
    if (!editor) {
      return;
    }
    this.currentThreadCollapseStateListener?.dispose();
    const newDecoration: {
      range: IRange;
      options: model.IModelDecorationOptions;
    }[] = [];

    if (thread) {
      const range = thread.range;
      if (!thread.isCollapsed.get()) {
        this.currentThreadCollapseStateListener = thread.onDidChangeCollapsibleState((state) => {
          if (state === CommentThreadCollapsibleState.Collapsed) {
            this.updateActiveThreadDecoration(undefined);
          }
        });
        newDecoration.push({
          range,
          options: this.createThreadRangeActiveDecoration(),
        });
      }
    }
    this.activeThreadDecorationIds = editor.monacoEditor.deltaDecorations(
      this.activeThreadDecorationIds,
      newDecoration,
    );
  }

  private createDottedRangeDecoration(): model.IModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-multiline-hover-decoration',
      linesDecorationsClassName: ['comment-range', 'multiline-add'].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private createHoverDecoration(): model.IModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-hover-decoration',
      linesDecorationsClassName: ['comment-range', 'line-hover', 'comment-add'].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private createThreadRangeActiveDecoration(): model.IModelDecorationOptions {
    const activeDecorationOptions: model.IModelDecorationOptions = {
      description: 'comments-thread-range-active-decoration',
      isWholeLine: false,
      zIndex: 20,
      className: 'comment-thread-range-current',
      shouldFillLineOnLineBreak: true,
    };

    return textModel.ModelDecorationOptions.createDynamic(activeDecorationOptions);
  }

  private createThreadRangeDecoration(): model.IModelDecorationOptions {
    const activeDecorationOptions: model.IModelDecorationOptions = {
      description: 'comments-thread-range-decoration',
      isWholeLine: false,
      zIndex: 20,
      className: 'comment-thread-range',
      shouldFillLineOnLineBreak: true,
    };

    return textModel.ModelDecorationOptions.createDynamic(activeDecorationOptions);
  }

  private createCommentRangeDecoration(): model.IModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-range-decoration',
      linesDecorationsClassName: ['comment-range', 'comment-diff-added'].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  public init() {
    const schemes = this.resourceService.getSupportedSchemes();
    for (const scheme of schemes) {
      this.shouldShowCommentsSchemes.add(scheme);
    }

    // 插件注册 ResourceProvider 时重新注册 CommentDecorationProvider
    // 例如 Github Pull Request 插件的 scheme 为 pr
    this.addDispose(
      this.resourceService.onRegisterResourceProvider((provider) => {
        if (provider.scheme) {
          this.shouldShowCommentsSchemes.add(provider.scheme);
          this.registerDecorationProvider();
        }
      }),
    );
    this.addDispose(
      this.resourceService.onUnregisterResourceProvider((provider) => {
        if (provider.scheme) {
          this.shouldShowCommentsSchemes.delete(provider.scheme);
          this.registerDecorationProvider();
        }
      }),
    );
    this.registerDecorationProvider();
  }

  private startCommentRange: IRange | null;
  private endCommentRange: IRange | null;
  private editor: IEditor | null;
  private allEditors: IEditor[] = [];

  getCurrentEditor(uri?: URI) {
    if (uri) {
      for (const editor of this.allEditors) {
        if (editor.currentUri?.isEqual(uri)) {
          this.editor = editor;
          return editor;
        }
      }
    }
    return this.editor;
  }

  public handleOnCreateEditor(editor: IEditor) {
    this.allEditors.push(editor);
    this.editor = editor;
    const disposer = new Disposable();
    let commentRangeDecorationIds: string[] = [];
    let hasHiddenArea = false;

    disposer.addDispose(
      editor.monacoEditor.onMouseDown((event) => {
        if (
          event.target.type === monacoBrowser.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
          event.target.element &&
          event.target.element.className.indexOf('comment-add') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            this.startCommentRange = range;
            event.event.stopPropagation();
          }
        } else if (
          event.target.type === monacoBrowser.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          event.target.element &&
          event.target.element.className.indexOf('comment-thread') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            const threads = this.commentsThreads.filter(
              (thread) =>
                editor.currentUri &&
                thread.uri.isEqual(editor.currentUri) &&
                thread.range.endLineNumber === range.endLineNumber,
            );
            if (threads.length) {
              const isShowWidget = threads.some((thread) => thread.isShowWidget(editor));
              if (isShowWidget) {
                threads.forEach((thread) => thread.hide(editor));
              } else {
                threads.forEach((thread) => thread.show(editor));
              }
            }
          }
          event.event.stopPropagation();
        }
      }),
    );

    disposer.addDispose(
      editor.monacoEditor.onMouseUp(async (event) => {
        if (this.startCommentRange) {
          if (hasHiddenArea) {
            this.renderCommentRange(editor);
            hasHiddenArea = false;
            this.startCommentRange = null;
            this.endCommentRange = null;
            return;
          }
          let range = this.startCommentRange;
          if (this.endCommentRange) {
            if (this.endCommentRange.startLineNumber < this.startCommentRange.startLineNumber) {
              range.startColumn = this.endCommentRange.startColumn;
              range.startLineNumber = this.endCommentRange.startLineNumber;
            } else {
              range.endColumn = this.endCommentRange.endColumn;
              range.endLineNumber = this.endCommentRange.endLineNumber;
            }
          }
          if (editor.currentUri) {
            range = await this.getValidRange(range, editor.currentUri);
          }
          if (range) {
            if (
              !this.commentsThreads.some(
                (thread) =>
                  thread.comments.get().length === 0 &&
                  editor.currentUri &&
                  thread.uri.isEqual(editor.currentUri) &&
                  thread.range.startLineNumber === range.startLineNumber &&
                  thread.range.endLineNumber === range.endLineNumber,
              )
            ) {
              const thread = this.createThread(editor.currentUri!, range);
              thread.show(editor);
            }
            event.event.stopPropagation();
          }
        } else if (
          event.target.type === monacoBrowser.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
          event.target.element &&
          event.target.element.className.indexOf('comment-range') > -1 &&
          event.target.element.className.indexOf('comment-thread') < 0
        ) {
          const { target } = event;
          const range: IRange | undefined = target.range;
          if (range) {
            if (
              !this.commentsThreads.some(
                (thread) =>
                  thread.comments.get().length === 0 &&
                  editor.currentUri &&
                  thread.uri.isEqual(editor.currentUri) &&
                  thread.range.startLineNumber === range.startLineNumber &&
                  thread.range.endLineNumber === range.endLineNumber,
              )
            ) {
              const thread = this.createThread(editor.currentUri!, range);
              thread.show(editor);
            }
            event.event.stopPropagation();
          }
        }
        this.startCommentRange = null;
        this.endCommentRange = null;
      }),
    );

    disposer.addDispose(
      editor.monacoEditor.onMouseMove(async (event) => {
        const uri = editor.currentUri;
        const range = event.target.range;
        // 多行评论
        if (this.startCommentRange) {
          if (!event.target.element?.className) {
            if (event.target.element?.offsetParent?.className.includes('diff-hidden-lines')) {
              // 当多行评论跨过折叠代码时，不创建评论
              hasHiddenArea = true;
            }
          }
          if (uri && range) {
            let selection = {
              startLineNumber: this.startCommentRange.startLineNumber,
              endLineNumber: range.endLineNumber,
              startColumn: this.startCommentRange.startColumn,
              endColumn: range.endColumn,
            };
            if (this.startCommentRange.startLineNumber > range.startLineNumber) {
              selection = {
                startLineNumber: range.startLineNumber,
                endLineNumber: this.startCommentRange.endLineNumber,
                startColumn: range.startColumn,
                endColumn: this.startCommentRange.endColumn,
              };
            }
            this.renderCommentRange(editor, selection);
            this.endCommentRange = range;
          }
        } else {
          if (uri && range && (await this.shouldShowHoverDecoration(uri, range))) {
            const newDecorations = [
              {
                range: positionToRange(range.startLineNumber),
                options: this.createHoverDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              },
            ];
            commentRangeDecorationIds = editor.monacoEditor.deltaDecorations(commentRangeDecorationIds, newDecorations);
          }
        }
      }),
    );

    disposer.addDispose(
      editor.monacoEditor.onMouseLeave(async (event) => {
        const range = event.target?.range;
        const newDecorations: {
          range: IRange;
          options: monaco.editor.IModelDecorationOptions;
        }[] = [];
        if (!this.startCommentRange && range) {
          newDecorations.push({
            range: positionToRange(range.startLineNumber),
            options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
          });
        }
        commentRangeDecorationIds = editor.monacoEditor.deltaDecorations(commentRangeDecorationIds, newDecorations);
      }),
    );

    disposer.addDispose(
      this.onCommentRangeProviderChange(() => {
        this.renderCommentRange(editor);
      }),
    );

    disposer.addDispose(
      Event.any(
        this.onThreadsChanged,
        this.onThreadsCommentChange,
        this.onThreadsCreated,
      )((thread) => {
        const editor = this.getCurrentEditor(thread.uri);
        if (editor) {
          this.renderCommentRange(editor);
        }
        this.updateActiveThreadDecoration(undefined);
      }),
    );

    disposer.addDispose(
      this.onDidChangeCurrentCommentThread((thread) => {
        this.updateActiveThreadDecoration(thread);
      }),
    );

    this.tryUpdateReservedSpace(editor);

    disposer.addDispose(
      editor.monacoEditor.onDidChangeModel(() => {
        this.renderCommentRange(editor);
        this.tryUpdateReservedSpace(editor);
      }),
    );
    return disposer;
  }

  private editorCommentingRangeSpaceReservedMap: Map<string, boolean> = new Map();
  private editorLineDecorationsWidthMap: Map<string, number> = new Map();

  private async getValidRange(range: IRange, uri?: URI) {
    if (!uri) {
      return range;
    }
    const contributionRanges = await this.getContributionRanges(uri);
    if (contributionRanges.length === 0) {
      return range;
    }
    const validRange = contributionRanges.find((contributionRange) => {
      if (
        range.startLineNumber >= contributionRange.startLineNumber &&
        range.startLineNumber <= contributionRange.endLineNumber
      ) {
        return true;
      }
    });
    if (validRange) {
      if (validRange.endLineNumber < range.endLineNumber) {
        return {
          startLineNumber: range.startLineNumber,
          startColumn: range.startColumn,
          endLineNumber: validRange.endLineNumber,
          endColumn: validRange.endColumn,
        };
      } else {
        return range;
      }
    } else {
      return range;
    }
  }

  private ensureCommentingRangeReservedAmount(editor: IEditor) {
    const existing = this.getExistingCommentEditorOptions(editor);
    const lineDecorationsWidth = this.editorLineDecorationsWidthMap.get(editor.getId());
    if (existing.lineDecorationsWidth !== lineDecorationsWidth) {
      editor.updateOptions({
        lineDecorationsWidth: this.getWithCommentsLineDecorationWidth(editor, existing.lineDecorationsWidth),
      });
    }
  }

  private async tryUpdateReservedSpace(editor: IEditor) {
    if (!editor) {
      return;
    }
    let commentingRangeSpaceReserved = this.editorCommentingRangeSpaceReservedMap.get(editor.getId()) || false;
    const shouldShowComments = editor.currentUri ? this.shouldShowCommentsSchemes.has(editor.currentUri.scheme) : false;

    const hasComments = this.commentsThreads.some(
      (thread) => editor.currentUri && thread.uri.isEqual(editor.currentUri) && thread.comments.get().length > 0,
    );

    const hasCommentsOrRanges = shouldShowComments || hasComments;
    if (hasCommentsOrRanges) {
      if (!commentingRangeSpaceReserved) {
        commentingRangeSpaceReserved = true;
        const { lineDecorationsWidth, extraEditorClassName } = this.getExistingCommentEditorOptions(editor);
        const newOptions = this.getWithCommentsEditorOptions(editor, extraEditorClassName, lineDecorationsWidth);
        this.updateEditorLayoutOptions(editor, newOptions.extraEditorClassName, newOptions.lineDecorationsWidth);
      } else {
        this.ensureCommentingRangeReservedAmount(editor);
      }
    } else if (!hasCommentsOrRanges && commentingRangeSpaceReserved) {
      commentingRangeSpaceReserved = false;
      const { lineDecorationsWidth, extraEditorClassName } = this.getExistingCommentEditorOptions(editor);
      const newOptions = this.getWithoutCommentsEditorOptions(editor, extraEditorClassName, lineDecorationsWidth);
      this.updateEditorLayoutOptions(editor, newOptions.extraEditorClassName, newOptions.lineDecorationsWidth);
    }
    this.editorCommentingRangeSpaceReservedMap.set(editor.getId(), commentingRangeSpaceReserved);
  }

  private getExistingCommentEditorOptions(editor: IEditor) {
    const lineDecorationsWidth: number = editor.monacoEditor.getOption(monaco.EditorOption.lineDecorationsWidth);
    let extraEditorClassName: string[] = [];
    const configuredExtraClassName = editor.monacoEditor.getRawOptions().extraEditorClassName;
    if (configuredExtraClassName) {
      extraEditorClassName = configuredExtraClassName.split(' ');
    }
    return { lineDecorationsWidth, extraEditorClassName };
  }

  private getWithoutCommentsEditorOptions(
    editor: IEditor,
    extraEditorClassName: string[],
    startingLineDecorationsWidth: number,
  ) {
    let lineDecorationsWidth = startingLineDecorationsWidth;
    const inlineCommentPos = extraEditorClassName.findIndex((name) => name === 'inline-comment');
    if (inlineCommentPos >= 0) {
      extraEditorClassName.splice(inlineCommentPos, 1);
    }

    const options = editor.monacoEditor.getOptions();
    if (options.get(monaco.EditorOption.folding) && options.get(monaco.EditorOption.showFoldingControls) !== 'never') {
      lineDecorationsWidth += 11; // 11 comes from https://github.com/microsoft/vscode/blob/94ee5f58619d59170983f453fe78f156c0cc73a3/src/vs/workbench/contrib/comments/browser/media/review.css#L485
    }
    lineDecorationsWidth -= 24;
    return { extraEditorClassName, lineDecorationsWidth };
  }

  private updateEditorLayoutOptions(editor: IEditor, extraEditorClassName: string[], lineDecorationsWidth: number) {
    editor.updateOptions({
      extraEditorClassName: extraEditorClassName.join(' '),
      lineDecorationsWidth,
    });
  }

  private getWithCommentsEditorOptions(
    editor: IEditor,
    extraEditorClassName: string[],
    startingLineDecorationsWidth: number,
  ) {
    extraEditorClassName.push('inline-comment');
    return {
      lineDecorationsWidth: this.getWithCommentsLineDecorationWidth(editor, startingLineDecorationsWidth),
      extraEditorClassName,
    };
  }

  private getWithCommentsLineDecorationWidth(editor: IEditor, startingLineDecorationsWidth: number) {
    let lineDecorationsWidth = startingLineDecorationsWidth;
    const options = editor.monacoEditor.getOptions();
    if (options.get(monaco.EditorOption.folding) && options.get(monaco.EditorOption.showFoldingControls) !== 'never') {
      lineDecorationsWidth -= 11;
    }
    lineDecorationsWidth += 24;
    this.editorLineDecorationsWidthMap.set(editor.getId(), lineDecorationsWidth);
    return lineDecorationsWidth;
  }

  private async renderCommentRange(
    editor: IEditor,
    selection: IRange = {
      startLineNumber: 0,
      endLineNumber: 0,
      startColumn: 0,
      endColumn: 0,
    },
  ) {
    if (!editor.currentUri) {
      return;
    }
    const contributionRanges = await this.getContributionRanges(editor.currentUri);
    if (contributionRanges.length > 0) {
      const newDecorations: {
        range: IRange;
        options: monaco.editor.IModelDecorationOptions;
      }[] = [];
      contributionRanges.map((contributionRange) => {
        if (selection.startLineNumber === 0 && selection.endLineNumber === 0) {
          newDecorations.push({
            range: contributionRange,
            options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
          });
        } else if (
          selection.startLineNumber <= contributionRange.startLineNumber &&
          selection.endLineNumber >= contributionRange.endLineNumber
        ) {
          newDecorations.push(
            ...[
              {
                range: contributionRange,
                options: this.createDottedRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              },
              {
                range: contributionRange,
                options: this.createThreadRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              },
            ],
          );
        } else if (selection.endLineNumber >= contributionRange.endLineNumber) {
          if (selection.startLineNumber <= contributionRange.endLineNumber) {
            // 存在交集
            const selectionRange = {
              startLineNumber: selection.startLineNumber,
              endLineNumber: contributionRange.endLineNumber,
              startColumn: selection.startColumn,
              endColumn: contributionRange.endColumn,
            };
            const topCommentRange = {
              startLineNumber: contributionRange.startLineNumber,
              endLineNumber: selectionRange.startLineNumber - 1,
              startColumn: contributionRange.startColumn,
              endColumn: selectionRange.endColumn,
            };
            newDecorations.push(
              ...[
                {
                  range: topCommentRange,
                  options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                },
                {
                  range: selectionRange,
                  options: this.createDottedRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                },
                {
                  range: selectionRange,
                  options: this.createThreadRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                },
              ],
            );
          } else {
            newDecorations.push({
              range: contributionRange,
              options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
            });
          }
        } else if (selection.endLineNumber < contributionRange.endLineNumber) {
          if (selection.endLineNumber >= contributionRange.startLineNumber) {
            // 存在交集
            if (selection.startLineNumber >= contributionRange.startLineNumber) {
              const topCommentRange = {
                startLineNumber: contributionRange.startLineNumber,
                startColumn: contributionRange.startColumn,
                endLineNumber: selection.startLineNumber - 1,
                endColumn: selection.startColumn,
              };
              const bottomCommentRange = {
                startLineNumber: selection.endLineNumber + 1,
                startColumn: selection.endColumn,
                endLineNumber: contributionRange.endLineNumber,
                endColumn: contributionRange.endColumn,
              };
              const decorations =
                selection.startLineNumber !== contributionRange.startLineNumber
                  ? [
                      {
                        range: topCommentRange,
                        options:
                          this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                      },
                    ]
                  : [];
              decorations.push({
                range: selection,
                options: this.createDottedRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              });
              decorations.push({
                range: selection,
                options: this.createThreadRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              });
              decorations.push({
                range: bottomCommentRange,
                options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              });
              newDecorations.push(...decorations);
            } else {
              const selectionRange = {
                startLineNumber: contributionRange.startLineNumber,
                startColumn: contributionRange.startColumn,
                endLineNumber: selection.endLineNumber,
                endColumn: selection.endColumn,
              };
              const bottomCommentRange = {
                startLineNumber: selectionRange.endLineNumber + 1,
                startColumn: selectionRange.endColumn,
                endLineNumber: contributionRange.endLineNumber,
                endColumn: contributionRange.endColumn,
              };
              newDecorations.push(
                ...[
                  {
                    range: selectionRange,
                    options: this.createDottedRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                  },
                  {
                    range: selectionRange,
                    options: this.createThreadRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                  },
                  {
                    range: bottomCommentRange,
                    options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
                  },
                ],
              );
            }
          } else {
            newDecorations.push({
              range: contributionRange,
              options: this.createCommentRangeDecoration() as unknown as monaco.editor.IModelDecorationOptions,
            });
          }
        }
      });
      const commentRangeDecorationIds = this.commentRangeDecorationMap.get(editor.currentUri.toString()) || [];
      this.commentRangeDecorationMap.set(
        editor.currentUri.toString(),
        editor.monacoEditor.deltaDecorations(commentRangeDecorationIds, newDecorations),
      );
    } else {
      this.commentRangeDecorationMap.set(editor.currentUri.toString(), []);
    }
  }

  private async shouldShowHoverDecoration(uri: URI, range: IRange) {
    if (!this.shouldShowCommentsSchemes.has(uri.scheme)) {
      return false;
    }
    const contributionRanges = await this.getContributionRanges(uri);
    const isProviderRanges = contributionRanges.some(
      (contributionRange) => range.startLineNumber <= contributionRange.endLineNumber,
    );
    return isProviderRanges;
  }

  public createThread(
    uri: URI,
    range: IRange,
    options: ICommentsThreadOptions = {
      comments: [],
      readOnly: false,
    },
  ) {
    // 获取当前 range 的 providerId，用于 commentController contextKey 的生成
    const providerId = this.getProviderIdsByLine(range.endLineNumber)[0];
    const thread = this.injector.get(CommentsThread, [uri, range, providerId, options]);
    thread.onDispose(() => {
      this.threads.delete(thread.id);
      this.threadsChangeEmitter.fire(thread);
      this.decorationChangeEmitter.fire(uri);
    });
    thread.onDidChange(() => {
      this.threadsChangeEmitter.fire(thread);
    });
    this.threads.set(thread.id, thread);
    this.addDispose(thread);
    this.threadsChangeEmitter.fire(thread);
    this.threadsCreatedEmitter.fire(thread);
    this.decorationChangeEmitter.fire(uri);
    return thread;
  }

  public getThreadsByUri(uri: URI) {
    return (
      this.commentsThreads
        .filter((thread) => thread.uri.isEqual(uri))
        // 默认按照 rang 顺序 升序排列
        .sort((a, b) => a.range.startLineNumber - b.range.startLineNumber)
    );
  }

  public handleCommentFileNode(parent: CommentRoot): CommentFileNode[] {
    const childs: CommentFileNode[] = [];

    const commentThreads = [...this.threads.values()].filter((thread) => thread.comments.get().length);
    const threadUris = groupBy(commentThreads, (thread: ICommentsThread) => thread.uri);
    Object.keys(threadUris).map((uri) => {
      const threads: ICommentsThread[] = threadUris[uri];
      if (threads.length === 0) {
        return;
      }
      const workspaceDir = new URI(this.appConfig.workspaceDir);
      const resource = new URI(uri);
      const description = workspaceDir.relative(resource)?.toString();
      childs.push(
        new CommentFileNode(
          this,
          threads,
          description,
          resource.codeUri.fsPath,
          this.labelService.getIcon(resource),
          resource,
          parent,
        ),
      );
    });

    return childs;
  }

  public handleCommentContentNode(parent: CommentFileNode): CommentContentNode[] {
    const childs: CommentContentNode[] = [];

    for (const thread of (parent as CommentFileNode).threads) {
      const comments = thread.comments.get();
      const [first] = comments;
      const comment = typeof first.body === 'string' ? first.body : first.body.value;
      let description = `[Ln ${thread.range.startLineNumber}]`;
      if (thread.range.startLineNumber !== thread.range.endLineNumber) {
        description = `[Ln ${thread.range.startLineNumber}-${thread.range.endLineNumber}]`;
      }
      childs.push(
        new CommentContentNode(
          this,
          thread,
          comment,
          description,
          first.author.iconPath && (first.author.iconPath as URI)?.authority
            ? (this.iconService.fromIcon('', first.author.iconPath.toString(), IconType.Background) as string)
            : getIcon('message'),
          first.author,
          parent.resource,
          parent as CommentFileNode,
        ),
      );
    }

    return childs;
  }

  public handleCommentReplyNode(parent: CommentContentNode): CommentReplyNode[] {
    const childs: CommentReplyNode[] = [];

    const thread = parent.thread;
    const comments = thread.comments.get();
    const [_, ...others] = comments;
    const lastReply = others[others.length - 1].author.name;
    childs.push(
      new CommentReplyNode(
        this,
        thread,
        formatLocalize('comment.reply.count', others?.length || 0),
        formatLocalize('comment.reply.lastReply', lastReply),
        '',
        parent.resource,
        parent,
      ),
    );

    return childs;
  }

  async resolveChildren(parent?: CommentRoot | CommentFileNode | CommentContentNode) {
    let childs: (CommentRoot | CommentFileNode | CommentContentNode | CommentReplyNode)[] = [];
    if (!parent) {
      childs.push(new CommentRoot(this));
    } else {
      if (CommentRoot.isRoot(parent)) {
        childs = this.handleCommentFileNode(parent);
      } else if (CommentFileNode.is(parent)) {
        childs = this.handleCommentContentNode(parent);
      } else if (CommentContentNode.is(parent)) {
        childs = this.handleCommentReplyNode(parent);
      }
    }
    if (childs.length === 1 && CommentRoot.isRoot(childs[0])) {
      return childs;
    }
    const handlers = this.commentsFeatureRegistry.getCommentsPanelTreeNodeHandlers();
    if (handlers.length > 0) {
      for (const handler of handlers) {
        childs = handler(childs as IWriteableCommentsTreeNode[]) as (
          | CommentFileNode
          | CommentContentNode
          | CommentReplyNode
        )[];
      }
    }
    return childs;
  }

  public async getContributionRanges(uri: URI): Promise<IRange[]> {
    // 一个diff editor对应两个uri，两个uri的rangeOwner不应该互相覆盖
    const cache = this.providerDecorationCache.get(uri.toString());
    // 优先从缓存中拿
    if (cache) {
      return await cache.promise;
    }

    const model = this.documentService.getModelReference(uri, 'Get Comment Range');
    const rangePromise: Promise<IRange[] | undefined>[] = [];
    for (const rangeProvider of this.rangeProviderMap) {
      const [id, provider] = rangeProvider;
      rangePromise.push(
        (async () => {
          if (!model?.instance) {
            return;
          }
          const ranges = await provider.getCommentingRanges(model.instance);
          if (ranges && ranges.length) {
            // FIXME: ranges 会被 Diff uri 的两个 range 互相覆盖，导致可能根据行查不到 provider
            this.rangeOwner.set(id, ranges);
          }
          return ranges;
        })(),
      );
    }
    const deferredRes = new Deferred<IRange[]>();
    this.providerDecorationCache.set(uri.toString(), deferredRes);
    const res = (await Promise.all(rangePromise)).filter(Boolean) as IRange[][];
    // 消除 document 引用
    model?.dispose();
    // 拍平，去掉 undefined
    const flattenRange: IRange[] = flattenDeep(res).filter(Boolean) as IRange[];
    deferredRes.resolve(flattenRange);
    return flattenRange;
  }

  public fireThreadCommentChange(thread: ICommentsThread) {
    this.threadsCommentChangeEmitter.fire(thread);
  }

  private registerDecorationProvider() {
    // dispose 掉上一个 decorationProvider
    this.decorationProviderDisposer.dispose();
    this.decorationProviderDisposer = this.editorDecorationCollectionService.registerDecorationProvider({
      schemes: [...this.shouldShowCommentsSchemes.values()],
      key: 'comments',
      onDidDecorationChange: this.decorationChangeEmitter.event,
      provideEditorDecoration: (uri: URI) =>
        this.commentsThreads
          .map((thread) => {
            if (thread.uri.isEqual(uri)) {
              if (thread.comments.get().length) {
                // 存在评论内容 恢复之前的现场
                thread.showWidgetsIfShowed();
              }
            } else {
              // 临时隐藏，当切回来时会恢复
              thread.hide();
            }
            return thread;
          })
          .filter((thread) => {
            const isCurrentThread = thread.uri.isEqual(uri);
            if (this.filterThreadDecoration) {
              return isCurrentThread && this.filterThreadDecoration(thread);
            }
            return isCurrentThread;
          })
          .map((thread) => ({
            range: {
              startLineNumber: thread.range.endLineNumber,
              endLineNumber: thread.range.endLineNumber,
              startColumn: thread.range.endColumn,
              endColumn: thread.range.endColumn,
            },
            options: this.createThreadDecoration(thread) as unknown as monaco.editor.IModelDecorationOptions,
          })),
    });
    this.addDispose(this.decorationProviderDisposer);
  }

  public registerCommentPanel() {
    // 面板只注册一次
    if (this.layoutService.getTabbarHandler(CommentPanelId)) {
      return;
    }
    this.layoutService.collectTabbarComponent(
      [
        {
          id: CommentPanelId,
          component: CommentsPanel,
        },
      ],
      {
        badge: this.panelBadge,
        containerId: CommentPanelId,
        title: localize('comments').toUpperCase(),
        hidden: false,
        activateKeyBinding: 'ctrlcmd+shift+c',
        ...this.commentsFeatureRegistry.getCommentsPanelOptions(),
      },
      'bottom',
    );
  }

  get panelBadge() {
    const length = this.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommentRangeProvider(id: string, provider: ICommentRangeProvider): IDisposable {
    this.rangeProviderMap.set(id, provider);
    // 注册一个新的 range provider 后清理掉之前的缓存
    this.providerDecorationCache.clear();
    this.commentRangeProviderChangeEmitter.fire();
    return Disposable.create(() => {
      this.rangeProviderMap.delete(id);
      this.rangeOwner.delete(id);
      this.providerDecorationCache.clear();
    });
  }

  forceUpdateDecoration(): void {
    // 默认适应当前 uri 去强刷 decoration
    // 这个值为 core editor 或者 modified editor
    const uri = this.workbenchEditorService.currentEditor?.currentUri;
    uri && this.decorationChangeEmitter.fire(uri);
    // diffeditor 的 originalUri 也需要更新 Decoration
    const originalUri = this.workbenchEditorService.currentEditorGroup?.diffEditor?.originalEditor.currentUri;
    originalUri && this.decorationChangeEmitter.fire(originalUri);
  }

  public getProviderIdsByLine(line: number): string[] {
    const result: string[] = [];
    if (this.rangeOwner.size === 1) {
      return [this.rangeOwner.keys().next().value!];
    }
    for (const rangeOwner of this.rangeOwner) {
      const [id, ranges] = rangeOwner;
      if (ranges && ranges.some((range) => range.startLineNumber <= line && line <= range.endLineNumber)) {
        result.push(id);
      }
    }

    return result;
  }
}
