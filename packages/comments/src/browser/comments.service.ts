import debounce from 'lodash/debounce';
import flattenDeep from 'lodash/flattenDeep';
import groupBy from 'lodash/groupBy';
import { observable, computed, action } from 'mobx';

import { INJECTOR_TOKEN, Injector, Injectable, Autowired } from '@opensumi/di';
import {
  Disposable,
  IRange,
  URI,
  Emitter,
  AppConfig,
  localize,
  getIcon,
  Event,
  memoize,
  IDisposable,
  positionToRange,
  Deferred,
  path,
  LRUCache,
} from '@opensumi/ide-core-browser';
import { IEditor } from '@opensumi/ide-editor';
import {
  IEditorDecorationCollectionService,
  IEditorDocumentModelService,
  ResourceService,
  WorkbenchEditorService,
} from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IIconService, IconType } from '@opensumi/ide-theme';
import * as model from '@opensumi/monaco-editor-core/esm/vs/editor/common/model';
import * as textModel from '@opensumi/monaco-editor-core/esm/vs/editor/common/model/textModel';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  ICommentsService,
  ICommentsThread,
  ICommentsTreeNode,
  ICommentsFeatureRegistry,
  CommentPanelId,
  ICommentRangeProvider,
  ICommentsThreadOptions,
} from '../common';

import { CommentsPanel } from './comments-panel.view';
import { CommentsThread } from './comments-thread';

const { dirname } = path;

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

  @observable
  private threads = new Map<string, ICommentsThread>();

  private threadsChangeEmitter = new Emitter<ICommentsThread>();

  private threadsCreatedEmitter = new Emitter<ICommentsThread>();

  private rangeProviderMap = new Map<string, ICommentRangeProvider>();

  private rangeOwner = new Map<string, IRange[]>();

  private providerDecorationCache = new LRUCache<string, Deferred<IRange[]>>(10000);

  // ????????? file ????????? git ???????????????????????????
  private shouldShowCommentsSchemes = new Set(['file', 'git']);

  private decorationProviderDisposer = Disposable.NULL;

  @observable
  private forceUpdateCount = 0;

  @computed
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

  get onThreadsCreated(): Event<ICommentsThread> {
    return this.threadsCreatedEmitter.event;
  }

  /**
   * -------------------------------- IMPORTANT --------------------------------
   * ?????????????????? model.IModelDecorationOptions ??? monaco.editor.IModelDecorationOptions ????????????
   * ??? model.IModelDecorationOptions ?????????????????????????????? monaco.editor.IModelDecorationOptions ????????????????????? Type Assertion
   * ???????????? monaco.d.ts ??? vs/editor/common/model ????????????????????? TrackedRangeStickiness
   * ???????????????????????????????????????????????????????????????????????????????????????????????????
   * -------------------------------- IMPORTANT --------------------------------
   * @param thread
   */
  private createThreadDecoration(thread: ICommentsThread): model.IModelDecorationOptions {
    // ????????????????????? thread???????????????????????????????????????????????????????????????????????????
    const avatar =
      thread.comments.length === 0 ? this.currentAuthorAvatar : thread.comments[0].author.iconPath?.toString();
    const icon = avatar ? this.iconService.fromIcon('', avatar, IconType.Background) : getIcon('message');
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-thread-decoration',
      // ????????????????????? glyph margin ???
      glyphMarginClassName: ['comments-decoration', 'comments-thread', icon].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  private createHoverDecoration(): model.IModelDecorationOptions {
    const decorationOptions: model.IModelDecorationOptions = {
      description: 'comments-hover-decoration',
      linesDecorationsClassName: ['comments-decoration', 'comments-add', getIcon('message')].join(' '),
    };
    return textModel.ModelDecorationOptions.createDynamic(decorationOptions);
  }

  public init() {
    // ???????????? ResourceProvider ??????????????? CommentDecorationProvider
    // ?????? Github Pull Request ????????? scheme ??? pr
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

  public handleOnCreateEditor(editor: IEditor) {
    const disposer = new Disposable();

    disposer.addDispose(
      editor.monacoEditor.onMouseDown((event) => {
        if (
          event.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_DECORATIONS &&
          event.target.element &&
          event.target.element.className.indexOf('comments-add') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            // ?????????????????????????????????????????????????????????????????????
            if (
              this.commentsThreads.some(
                (thread) =>
                  thread.comments.length === 0 &&
                  thread.uri.isEqual(editor.currentUri!) &&
                  thread.range.startLineNumber === range.startLineNumber,
              )
            ) {
              return;
            }
            const thread = this.createThread(editor.currentUri!, range);
            thread.show(editor);
          }
        } else if (
          event.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN &&
          event.target.element &&
          event.target.element.className.indexOf('comments-thread') > -1
        ) {
          const { target } = event;
          if (target && target.range) {
            const { range } = target;
            const threads = this.commentsThreads.filter(
              (thread) =>
                thread.uri.isEqual(editor.currentUri!) && thread.range.startLineNumber === range.startLineNumber,
            );
            if (threads.length) {
              // ???????????? widget ??????????????????
              const isShowWidget = threads.some((thread) => thread.isShowWidget(editor));

              if (isShowWidget) {
                threads.forEach((thread) => thread.hide(editor));
              } else {
                threads.forEach((thread) => thread.show(editor));
              }
            }
          }
        }
      }),
    );
    let oldDecorations: string[] = [];
    disposer.addDispose(
      editor.monacoEditor.onMouseMove(
        debounce(async (event) => {
          const uri = editor.currentUri;

          const range = event.target.range;
          if (uri && range && (await this.shouldShowHoverDecoration(uri, range))) {
            oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, [
              {
                range: positionToRange(range.startLineNumber),
                options: this.createHoverDecoration() as unknown as monaco.editor.IModelDecorationOptions,
              },
            ]);
          } else {
            oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, []);
          }
        }, 10),
      ),
    );

    disposer.addDispose(
      editor.monacoEditor.onMouseLeave(
        debounce(() => {
          oldDecorations = editor.monacoEditor.deltaDecorations(oldDecorations, []);
        }, 10),
      ),
    );

    return disposer;
  }

  private async shouldShowHoverDecoration(uri: URI, range: IRange) {
    if (!this.shouldShowCommentsSchemes.has(uri.scheme)) {
      return false;
    }
    const contributionRanges = await this.getContributionRanges(uri);
    const isProviderRanges = contributionRanges.some(
      (contributionRange) =>
        range.startLineNumber >= contributionRange.startLineNumber &&
        range.startLineNumber <= contributionRange.endLineNumber,
    );
    // ???????????????????????????????????????????????????????????????????????? thread ????????? decoration
    const isShowHoverToSingleLine =
      this.isMultiCommentsForSingleLine ||
      !this.commentsThreads.some(
        (thread) => thread.uri.isEqual(uri) && thread.range.startLineNumber === range.startLineNumber,
      );
    return isProviderRanges && isShowHoverToSingleLine;
  }

  public createThread(
    uri: URI,
    range: IRange,
    options: ICommentsThreadOptions = {
      comments: [],
      readOnly: false,
    },
  ) {
    // ???????????? range ??? providerId????????? commentController contextKey ?????????
    const providerId = this.getProviderIdsByLine(range.startLineNumber)[0];
    const thread = this.injector.get(CommentsThread, [uri, range, providerId, options]);
    thread.onDispose(() => {
      this.threads.delete(thread.id);
      this.threadsChangeEmitter.fire(thread);
      this.decorationChangeEmitter.fire(uri);
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
        // ???????????? rang ?????? ????????????
        .sort((a, b) => a.range.startLineNumber - b.range.startLineNumber)
    );
  }

  @action
  public forceUpdateTreeNodes() {
    this.forceUpdateCount++;
  }

  @computed
  get commentsTreeNodes(): ICommentsTreeNode[] {
    let treeNodes: ICommentsTreeNode[] = [];
    const commentThreads = [...this.threads.values()].filter((thread) => thread.comments.length);
    const threadUris = groupBy(commentThreads, (thread: ICommentsThread) => thread.uri);
    Object.keys(threadUris).forEach((uri) => {
      const threads: ICommentsThread[] = threadUris[uri];
      if (threads.length === 0) {
        return;
      }
      const firstThread = threads[0];
      const firstThreadUri = firstThread.uri;
      const filePath = dirname(firstThreadUri.path.toString().replace(this.appConfig.workspaceDir, ''));
      const rootNode: ICommentsTreeNode = {
        id: uri,
        name: firstThreadUri.displayName,
        uri: firstThreadUri,
        description: filePath.replace(/^\//, ''),
        parent: undefined,
        thread: firstThread,
        ...(threads.length && {
          expanded: true,
          children: [],
        }),
        // ?????? mobx computed??? ?????????????????? getCommentsPanelTreeNodeHandlers ??????
        _forceUpdateCount: this.forceUpdateCount,
      };
      treeNodes.push(rootNode);
      threads.forEach((thread) => {
        if (thread.comments.length === 0) {
          return;
        }
        const [firstComment, ...otherComments] = thread.comments;
        const firstCommentNode: ICommentsTreeNode = {
          id: firstComment.id,
          name: firstComment.author.name,
          iconStyle: {
            marginRight: 5,
            backgroundSize: '14px 14px',
          },
          icon: this.iconService.fromIcon('', firstComment.author.iconPath?.toString(), IconType.Background),
          description: firstComment.body,
          uri: thread.uri,
          parent: rootNode,
          depth: 1,
          thread,
          ...(otherComments.length && {
            expanded: true,
            children: [],
          }),
          comment: firstComment,
        };
        const firstCommentChildren = otherComments.map((comment) => {
          const otherCommentNode: ICommentsTreeNode = {
            id: comment.id,
            name: comment.author.name,
            description: comment.body,
            uri: thread.uri,
            iconStyle: {
              marginRight: 5,
              backgroundSize: '14px 14px',
            },
            icon: this.iconService.fromIcon('', comment.author.iconPath?.toString(), IconType.Background),
            parent: firstCommentNode,
            depth: 2,
            thread,
            comment,
          };
          return otherCommentNode;
        });
        treeNodes.push(firstCommentNode);
        treeNodes.push(...firstCommentChildren);
      });
    });

    for (const handler of this.commentsFeatureRegistry.getCommentsPanelTreeNodeHandlers()) {
      treeNodes = handler(treeNodes);
    }

    return treeNodes;
  }

  public async getContributionRanges(uri: URI): Promise<IRange[]> {
    // ??????diff editor????????????uri?????????uri???rangeOwner?????????????????????
    const cache = this.providerDecorationCache.get(uri.toString());
    // ?????????????????????
    if (cache) {
      return await cache.promise;
    }

    const model = this.documentService.getModelReference(uri);
    const rangePromise: Promise<IRange[] | undefined>[] = [];
    for (const rangeProvider of this.rangeProviderMap) {
      const [id, provider] = rangeProvider;
      rangePromise.push(
        (async () => {
          const ranges = await provider.getCommentingRanges(model?.instance!);
          if (ranges && ranges.length) {
            // FIXME: ranges ?????? Diff uri ????????? range ????????????????????????????????????????????? provider
            this.rangeOwner.set(id, ranges);
          }
          return ranges;
        })(),
      );
    }
    const deferredRes = new Deferred<IRange[]>();
    this.providerDecorationCache.set(uri.toString(), deferredRes);
    const res = await Promise.all(rangePromise);
    // ?????? document ??????
    model?.dispose();
    // ??????????????? undefined
    const flattenRange: IRange[] = flattenDeep(res).filter(Boolean) as IRange[];
    deferredRes.resolve(flattenRange);
    return flattenRange;
  }

  private registerDecorationProvider() {
    // dispose ???????????? decorationProvider
    this.decorationProviderDisposer.dispose();
    this.decorationProviderDisposer = this.editorDecorationCollectionService.registerDecorationProvider({
      schemes: [...this.shouldShowCommentsSchemes.values()],
      key: 'comments',
      onDidDecorationChange: this.decorationChangeEmitter.event,
      provideEditorDecoration: (uri: URI) =>
        this.commentsThreads
          .map((thread) => {
            if (thread.uri.isEqual(uri)) {
              // ?????????????????????
              thread.showWidgetsIfShowed();
            } else {
              // ???????????????????????????????????????
              thread.hideWidgetsByDispose();
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
            range: thread.range,
            options: this.createThreadDecoration(thread) as unknown as monaco.editor.IModelDecorationOptions,
          })),
    });
    this.addDispose(this.decorationProviderDisposer);
  }

  public registerCommentPanel() {
    // ?????????????????????
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
    // ?????????????????? range provider ???????????????????????????
    this.providerDecorationCache.clear();
    return Disposable.create(() => {
      this.rangeProviderMap.delete(id);
      this.rangeOwner.delete(id);
      this.providerDecorationCache.clear();
    });
  }

  forceUpdateDecoration(): void {
    // ?????????????????? uri ????????? decoration
    // ???????????? core editor ?????? modified editor
    const uri = this.workbenchEditorService.currentEditor?.currentUri;
    uri && this.decorationChangeEmitter.fire(uri);
    // diffeditor ??? originalUri ??????????????? Decoration
    const originalUri = this.workbenchEditorService.currentEditorGroup?.diffEditor.originalEditor.currentUri;
    originalUri && this.decorationChangeEmitter.fire(originalUri);
  }

  public getProviderIdsByLine(line: number): string[] {
    const result: string[] = [];
    if (this.rangeOwner.size === 1) {
      // ????????????provider???????????????
      return [this.rangeOwner.keys().next().value];
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
