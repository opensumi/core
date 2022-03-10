import { observable } from 'mobx';

import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import {
  FILE_COMMANDS,
  ResizeEvent,
  getSlotLocation,
  AppConfig,
  IContextKeyService,
  ServiceNames,
  IScopedContextKeyService,
  IContextKey,
  RecentFilesManager,
  PreferenceService,
  IOpenerService,
} from '@opensumi/ide-core-browser';
import { ResourceContextKey } from '@opensumi/ide-core-browser/lib/contextkey/resource';
import { isUndefinedOrNull, Schemas, REPORT_NAME } from '@opensumi/ide-core-common';
import {
  CommandService,
  URI,
  getDebugLogger,
  MaybeNull,
  Deferred,
  Emitter as EventEmitter,
  Event,
  WithEventBus,
  OnEvent,
  StorageProvider,
  IStorage,
  STORAGE_NAMESPACE,
  ContributionProvider,
  Emitter,
  formatLocalize,
  IReporterService,
  ILogger,
  ReadyEvent,
  IDisposable,
  Disposable,
} from '@opensumi/ide-core-common';
import { makeRandomHexString } from '@opensumi/ide-core-common/lib/functional';
import { IMessageService } from '@opensumi/ide-overlay';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import {
  WorkbenchEditorService,
  EditorCollectionService,
  ICodeEditor,
  IResource,
  ResourceService,
  IResourceOpenOptions,
  IDiffEditor,
  IDiffResource,
  IEditor,
  CursorStatus,
  IEditorOpenType,
  EditorGroupSplitAction,
  IEditorGroup,
  IOpenResourceResult,
  IEditorGroupState,
  ResourceDecorationChangeEvent,
  IUntitledOptions,
  SaveReason,
  getSplitActionFromDragDrop,
} from '../common';

import { IEditorDocumentModelService, IEditorDocumentModelRef } from './doc-model/types';
import { EditorTabChangedError, isEditorError } from './error';
import { IGridEditorGroup, EditorGrid, SplitDirection, IEditorGridState } from './grid/grid.service';
import {
  EditorComponentRegistry,
  IEditorComponent,
  GridResizeEvent,
  DragOverPosition,
  EditorGroupOpenEvent,
  EditorGroupChangeEvent,
  EditorSelectionChangeEvent,
  EditorVisibleChangeEvent,
  EditorConfigurationChangedEvent,
  EditorGroupIndexChangedEvent,
  EditorComponentRenderMode,
  EditorGroupCloseEvent,
  EditorGroupDisposeEvent,
  BrowserEditorContribution,
  ResourceOpenTypeChangedEvent,
  EditorComponentDisposeEvent,
  EditorActiveResourceStateChangedEvent,
  CodeEditorDidVisibleEvent,
  RegisterEditorComponentEvent,
} from './types';

@Injectable()
export class WorkbenchEditorServiceImpl extends WithEventBus implements WorkbenchEditorService {
  editorGroups: EditorGroup[] = [];

  _onDidEditorGroupsChanged = new EventEmitter<void>();
  onDidEditorGroupsChanged: Event<void> = this._onDidEditorGroupsChanged.event;

  private _sortedEditorGroups: EditorGroup[] | undefined = [];

  @Autowired(INJECTOR_TOKEN)
  private injector!: Injector;

  private readonly _onActiveResourceChange = new EventEmitter<MaybeNull<IResource>>();
  public readonly onActiveResourceChange: Event<MaybeNull<IResource>> = this._onActiveResourceChange.event;

  private readonly _onActiveEditorUriChange = new EventEmitter<MaybeNull<URI>>();
  public readonly onActiveEditorUriChange: Event<MaybeNull<URI>> = this._onActiveEditorUriChange.event;

  private readonly _onCursorChange = new EventEmitter<CursorStatus>();
  public readonly onCursorChange: Event<CursorStatus> = this._onCursorChange.event;

  public topGrid: EditorGrid;

  private _currentEditorGroup: IEditorGroup;

  _onDidCurrentEditorGroupChanged = new EventEmitter<IEditorGroup>();
  onDidCurrentEditorGroupChanged: Event<IEditorGroup> = this._onDidCurrentEditorGroupChanged.event;

  @Autowired(StorageProvider)
  getStorage: StorageProvider;

  openedResourceState: IStorage;

  private _restoring = true;

  public contributionsReady = new Deferred<void>();

  private initializing: Promise<any>;

  public editorContextKeyService: IScopedContextKeyService;

  private _domNode: HTMLElement;

  @Autowired(BrowserEditorContribution)
  private readonly contributions: ContributionProvider<BrowserEditorContribution>;

  @Autowired(IEditorDocumentModelService)
  protected documentModelManager: IEditorDocumentModelService;

  private untitledIndex = 1;

  private untitledCloseIndex: number[] = [];

  public gridReady = false;
  private _onDidGridReady = new Emitter<void>();
  public onDidGridReady = this._onDidGridReady.event;

  constructor() {
    super();
    this.initialize();
  }

  setEditorContextKeyService(contextKeyService: IScopedContextKeyService): void {
    this.editorContextKeyService = contextKeyService;
  }

  setCurrentGroup(editorGroup) {
    if (editorGroup) {
      if (this._currentEditorGroup === editorGroup) {
        return;
      }
      this._currentEditorGroup = editorGroup;
      this._onActiveResourceChange.fire(editorGroup.currentResource);
      this.eventBus.fire(
        new EditorActiveResourceStateChangedEvent({
          resource: editorGroup.currentResource,
          openType: editorGroup.currentOpenType,
          editorUri: this.currentEditor?.currentUri,
        }),
      );
      this._onDidCurrentEditorGroupChanged.fire(this._currentEditorGroup);
    }
  }

  @OnEvent(EditorGroupChangeEvent)
  onEditorGroupChangeEvent(e: EditorGroupChangeEvent) {
    if (e.payload.group === this.currentEditorGroup) {
      this.eventBus.fire(
        new EditorActiveResourceStateChangedEvent({
          resource: e.payload.newResource,
          openType: e.payload.newOpenType,
          editorUri: this.currentEditor?.currentUri,
        }),
      );
    }
  }

  getAllOpenedUris() {
    const uris: URI[] = [];
    for (const group of this.editorGroups) {
      for (const resource of group.resources) {
        const index = uris.findIndex((u) => u.isEqual(resource.uri));
        if (index === -1) {
          uris.push(resource.uri);
        }
      }
    }
    return uris;
  }

  async saveAll(includeUntitled?: boolean, reason?: SaveReason) {
    for (const editorGroup of this.editorGroups) {
      await editorGroup.saveAll(includeUntitled, reason);
    }
  }

  hasDirty(): boolean {
    for (const editorGroup of this.editorGroups) {
      if (editorGroup.hasDirty()) {
        return true;
      }
    }
    return false;
  }

  createEditorGroup(): EditorGroup {
    const editorGroup = this.injector.get(EditorGroup, [this.generateRandomEditorGroupName()]);
    this.editorGroups.push(editorGroup);
    const currentWatchDisposer = new Disposable(
      editorGroup.onDidEditorGroupBodyChanged(() => {
        if (editorGroup === this.currentEditorGroup) {
          if (!editorGroup.currentOpenType && editorGroup.currentResource) {
            // 暂时状态，不发事件
          } else {
            this._onActiveResourceChange.fire(editorGroup.currentResource);
          }
        }
      }),
      editorGroup.onDidEditorFocusChange(() => {
        if (editorGroup === this.currentEditorGroup) {
          if (!editorGroup.currentOpenType && editorGroup.currentResource) {
            // 暂时状态，不发事件
          } else {
            this._onActiveEditorUriChange.fire(editorGroup.currentOrPreviousFocusedEditor?.currentUri);
          }
        }
      }),
    );
    editorGroup.addDispose({
      dispose: () => {
        currentWatchDisposer.dispose();
      },
    });
    const groupChangeDisposer = editorGroup.onDidEditorGroupTabChanged(() => {
      this.saveOpenedResourceState();
    });
    editorGroup.addDispose({
      dispose: () => {
        groupChangeDisposer.dispose();
      },
    });
    editorGroup.onCurrentEditorCursorChange((e) => {
      if (this._currentEditorGroup === editorGroup) {
        this._onCursorChange.fire(e);
      }
    });
    this._sortedEditorGroups = undefined;
    this._onDidEditorGroupsChanged.fire();
    return editorGroup;
  }

  /**
   * 随机生成一个不重复的editor Group
   */
  private generateRandomEditorGroupName() {
    let name = makeRandomHexString(5);
    while (this.editorGroups.findIndex((g) => g.name === name) !== -1) {
      name = makeRandomHexString(5);
    }
    return name;
  }

  public initialize() {
    if (!this.initializing) {
      this.initializing = this.doInitialize();
    }
    return this.initializing;
  }

  private async doInitialize() {
    this.openedResourceState = await this.initializeState();
    await this.contributionsReady.promise;
    await this.restoreState();
    this._currentEditorGroup = this.editorGroups[0];
  }

  private async initializeState() {
    const state = await this.getStorage(STORAGE_NAMESPACE.WORKBENCH);
    return state;
  }

  public get currentEditor(): IEditor | null {
    return this.currentEditorGroup && this.currentEditorGroup.currentEditor;
  }

  public get currentCodeEditor(): ICodeEditor | null {
    return this.currentEditorGroup.currentCodeEditor;
  }

  public get currentEditorGroup(): EditorGroup {
    return this._currentEditorGroup as any;
  }

  async open(uri: URI, options?: IResourceOpenOptions) {
    await this.initialize();
    let group = this.currentEditorGroup;
    let groupIndex: number | undefined;
    if (options && typeof options.groupIndex !== 'undefined') {
      groupIndex = options.groupIndex;
    } else if (options && options.relativeGroupIndex) {
      groupIndex = this.currentEditorGroup.index + options.relativeGroupIndex;
    }
    if (typeof groupIndex === 'number' && groupIndex >= 0) {
      if (groupIndex >= this.editorGroups.length) {
        return group.open(uri, Object.assign({}, options, { split: EditorGroupSplitAction.Right }));
      } else {
        group = this.sortedEditorGroups[groupIndex] || this.currentEditorGroup;
      }
    }
    return group.open(uri, options);
  }

  async openUris(uris: URI[]) {
    await this.initialize();
    await this.currentEditorGroup.openUris(uris);
    return;
  }

  getEditorGroup(name: string): EditorGroup | undefined {
    return this.editorGroups.find((g) => g.name === name);
  }

  get currentResource(): MaybeNull<IResource> {
    if (!this.currentEditorGroup) {
      return null;
    }
    return this.currentEditorGroup.currentResource;
  }

  removeGroup(group: EditorGroup) {
    const index = this.editorGroups.findIndex((e) => e === group);
    if (index !== -1) {
      if (this.editorGroups.length === 1) {
        return;
      }
      this.editorGroups.splice(index, 1);
      if (this.currentEditorGroup === group) {
        this.setCurrentGroup(this.editorGroups[0]);
      }
      for (let i = index; i < this.editorGroups.length; i++) {
        this.eventBus.fire(
          new EditorGroupIndexChangedEvent({
            group: this.editorGroups[i],
            index: i,
          }),
        );
      }
      this._onDidEditorGroupsChanged.fire();
    }
    this._sortedEditorGroups = undefined;
  }

  public async saveOpenedResourceState() {
    if (this._restoring) {
      return;
    }
    const state: IEditorGridState = this.topGrid.serialize()!;
    await this.openedResourceState.set('grid', state);
  }

  prepareContextKeyService() {
    // contextKeys
    const getLanguageFromModel = (uri: URI) => {
      let result: string | null = null;
      const modelRef = this.documentModelManager.getModelReference(uri, 'resourceContextKey');
      if (modelRef) {
        if (modelRef) {
          result = modelRef.instance.languageId;
        }
        modelRef.dispose();
      }
      return result;
    };
    const resourceContext = new ResourceContextKey(this.editorContextKeyService, (uri: URI) => {
      const res = getLanguageFromModel(uri);
      if (res) {
        return res!;
      } else {
        return getLanguageFromModel(uri);
      }
    });
    this.onActiveResourceChange((resource) => {
      if (this.currentEditor && this.currentEditor.currentUri) {
        resourceContext.set(this.currentEditor.currentUri);
      } else {
        if (resource) {
          resourceContext.set(resource.uri);
        } else {
          resourceContext.reset();
        }
      }
    });

    if (this.currentEditor && this.currentEditor.currentUri) {
      resourceContext.set(this.currentEditor.currentUri);
    } else {
      if (this.currentResource) {
        resourceContext.set(this.currentResource.uri);
      } else {
        resourceContext.reset();
      }
    }
  }

  onDomCreated(domNode: HTMLElement) {
    this._domNode = domNode;
    if (this.editorContextKeyService) {
      this.editorContextKeyService.attachToDomNode(domNode);
    }
  }

  public async restoreState() {
    let state: IEditorGridState = { editorGroup: { uris: [], previewIndex: -1 } };
    state = this.openedResourceState.get<IEditorGridState>('grid', state);
    this.topGrid = new EditorGrid();
    const editorRestorePromises = [];
    const promise = this.topGrid
      .deserialize(state, () => this.createEditorGroup(), editorRestorePromises)
      .then(() => {
        if (this.topGrid.children.length === 0 && !this.topGrid.editorGroup) {
          this.topGrid.setEditorGroup(this.createEditorGroup());
        }
        this.gridReady = true;
        this._onDidGridReady.fire();
      });
    Promise.all(editorRestorePromises).then(() => {
      this._restoring = false;
      for (const contribution of this.contributions.getContributions()) {
        if (contribution.onDidRestoreState) {
          contribution.onDidRestoreState();
        }
      }
    });
    return promise;
  }

  async closeAll(uri?: URI, force?: boolean) {
    for (const group of this.editorGroups.slice(0)) {
      if (uri) {
        await group.close(uri, { force });
      } else {
        await group.closeAll();
      }
    }
  }

  async close(uri: URI, force?: boolean) {
    return this.closeAll(uri, force);
  }

  get sortedEditorGroups() {
    if (!this._sortedEditorGroups) {
      this._sortedEditorGroups = [];
      this.topGrid.sortEditorGroups(this._sortedEditorGroups);
    }
    return this._sortedEditorGroups;
  }

  @OnEvent(EditorGroupCloseEvent)
  handleOnCloseUntitledResource(e: EditorGroupCloseEvent) {
    if (e.payload.resource.uri.scheme === Schemas.untitled) {
      const { index } = e.payload.resource.uri.getParsedQuery();
      this.untitledCloseIndex.push(parseInt(index, 10));
      // 升序排序，每次可以去到最小的 index
      this.untitledCloseIndex.sort((a, b) => a - b);
    }
  }

  private createUntitledURI() {
    // 优先从已删除的 index 中获取
    const index = this.untitledCloseIndex.shift() || this.untitledIndex++;
    return new URI().withScheme(Schemas.untitled).withQuery(`name=Untitled-${index}&index=${index}`);
  }

  createUntitledResource(
    options: IUntitledOptions = {
      uri: this.createUntitledURI(),
    },
  ) {
    return this.open(options.uri, {
      preview: false,
      focus: true,
      ...options.resourceOpenOptions,
    });
  }
}

export interface IEditorCurrentState {
  currentResource: IResource;

  currentOpenType: IEditorOpenType;
}
/**
 * Editor Group是一个可视的编辑区域
 * 它由tab，editor，diff-editor，富组件container组成
 */
@Injectable({ multiple: true })
export class EditorGroup extends WithEventBus implements IGridEditorGroup {
  @Autowired()
  collectionService!: EditorCollectionService;

  @Autowired()
  resourceService: ResourceService;

  @Autowired()
  editorComponentRegistry: EditorComponentRegistry;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(IEditorDocumentModelService)
  protected documentModelManager: IEditorDocumentModelService;

  @Autowired(CommandService)
  private commands: CommandService;

  @Autowired(PreferenceService)
  protected readonly preferenceService: PreferenceService;

  @Autowired(RecentFilesManager)
  private readonly recentFilesManager: RecentFilesManager;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(IReporterService)
  private reporterService: IReporterService;

  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(IOpenerService)
  private readonly openerService: IOpenerService;

  @Autowired(ILogger)
  logger: ILogger;

  codeEditor!: ICodeEditor;

  diffEditor!: IDiffEditor;

  private openingPromise: Map<string, Promise<IOpenResourceResult>> = new Map();

  _onDidEditorFocusChange = this.registerDispose(new EventEmitter<void>());
  onDidEditorFocusChange: Event<void> = this._onDidEditorFocusChange.event;

  /**
   * 当编辑器的tab部分发生变更
   */
  _onDidEditorGroupTabChanged = new EventEmitter<void>();
  onDidEditorGroupTabChanged: Event<void> = this._onDidEditorGroupTabChanged.event;

  /**
   * 当编辑器的主体部分发生变更
   */
  _onDidEditorGroupBodyChanged = new EventEmitter<void>();
  onDidEditorGroupBodyChanged: Event<void> = this._onDidEditorGroupBodyChanged.event;

  /**
   * 当编辑器有内容处于加载状态
   */
  _onDidEditorGroupContentLoading = new EventEmitter<IResource>();
  onDidEditorGroupContentLoading: Event<IResource> = this._onDidEditorGroupContentLoading.event;

  /**
   * 每个group只能有一个preview
   */
  public previewURI: URI | null = null;

  /**
   * 当前打开的所有resource
   */
  // @observable.shallow
  resources: IResource[] = [];

  resourceStatus: Map<IResource, Promise<void>> = new Map();

  // @observable.ref
  _currentResource: IResource | null;

  _currentOpenType: IEditorOpenType | null;

  /**
   * 当前resource的打开方式
   */
  private cachedResourcesActiveOpenTypes = new Map<string, IEditorOpenType>();

  private cachedResourcesOpenTypes = new Map<string, IEditorOpenType[]>();

  @observable.shallow
  availableOpenTypes: IEditorOpenType[] = [];

  activeComponents = new Map<IEditorComponent, IResource[]>();

  activateComponentsProps = new Map<IEditorComponent, any>();

  public grid: EditorGrid;

  private holdDocumentModelRefs: Map<string, IEditorDocumentModelRef> = new Map();

  private readonly toDispose: monaco.IDisposable[] = [];

  private _contextKeyService: IContextKeyService;

  private _resourceContext: ResourceContextKey;

  private _editorLangIDContextKey: IContextKey<string>;

  private _isInDiffEditorContextKey: IContextKey<boolean>;

  private _diffResourceContextKey: ResourceContextKey;

  private _isInDiffRightEditorContextKey: IContextKey<boolean>;

  private _isInEditorComponentContextKey: IContextKey<boolean>;

  private _prevDomHeight = 0;
  private _prevDomWidth = 0;

  private _codeEditorPendingLayout = false;
  private _diffEditorPendingLayout = false;

  // 当前为EditorComponent，且monaco光标变化时触发
  private _onCurrentEditorCursorChange = new EventEmitter<CursorStatus>();
  public onCurrentEditorCursorChange = this._onCurrentEditorCursorChange.event;

  private resourceOpenHistory: URI[] = [];

  private _domNode: MaybeNull<HTMLElement> = null;

  private codeEditorReady = new ReadyEvent();

  private diffEditorReady = new ReadyEvent();

  private _restoringState = false;

  private updateContextKeyWhenEditorChangesFocusDisposer: IDisposable;

  private _currentOrPreviousFocusedEditor: IEditor | null;

  constructor(public readonly name: string) {
    super();
    this.eventBus.on(ResizeEvent, (e: ResizeEvent) => {
      if (e.payload.slotLocation === getSlotLocation('@opensumi/ide-editor', this.config.layoutConfig)) {
        this.doLayoutEditors();
      }
    });
    this.eventBus.on(GridResizeEvent, (e: GridResizeEvent) => {
      if (e.payload.gridId === this.grid.uid) {
        this.doLayoutEditors();
      }
    });
    this.eventBus.on(EditorComponentDisposeEvent, (e: EditorComponentDisposeEvent) => {
      this.activeComponents.delete(e.payload);
      this.activateComponentsProps.delete(e.payload);
    });

    this.listenToExplorerAutoRevealConfig();
  }

  private explorerAutoRevealConfig: boolean;
  private listenToExplorerAutoRevealConfig() {
    this.explorerAutoRevealConfig = !!this.preferenceService.get<boolean>('explorer.autoReveal');
    this.disposables.push(
      this.preferenceService.onPreferenceChanged((change) => {
        if (change.preferenceName === 'explorer.autoReveal') {
          this.explorerAutoRevealConfig = change.newValue;
        }
      }),
    );
  }

  attachToDom(domNode: HTMLElement | null | undefined) {
    this._domNode = domNode;
    if (domNode) {
      (this.contextKeyService as IScopedContextKeyService).attachToDomNode(domNode);
      this.layoutEditors();
    }
  }

  layoutEditors() {
    if (this._domNode) {
      const currentWidth = this._domNode.offsetWidth;
      const currentHeight = this._domNode.offsetHeight;
      if (currentWidth !== this._prevDomWidth || currentHeight !== this._prevDomHeight) {
        this.doLayoutEditors();
      }
      this._prevDomWidth = currentWidth;
      this._prevDomHeight = currentHeight;
    }
  }

  doLayoutEditors() {
    if (this.codeEditor) {
      if (this.currentOpenType && this.currentOpenType.type === 'code') {
        this.codeEditor.layout();
        this._codeEditorPendingLayout = false;
      } else {
        this._codeEditorPendingLayout = true;
      }
    }
    if (this.diffEditor) {
      if (this.currentOpenType && this.currentOpenType.type === 'diff') {
        this.diffEditor.layout();
        this._diffEditorPendingLayout = false;
      } else {
        this._diffEditorPendingLayout = true;
      }
    }
  }

  // get currentState() {
  //   return this._currentState;
  // }

  // set currentState(value: IEditorCurrentState | null) {
  //   const oldResource = this.currentResource;
  //   const oldOpenType = this.currentOpenType;
  //   this._currentState = value;
  //   this._pendingState = null;
  //   if (oldResource && this.resourceOpenHistory[this.resourceOpenHistory.length - 1] !== oldResource.uri) {
  //     this.resourceOpenHistory.push(oldResource.uri);
  //   }
  //   this.eventBus.fire(new EditorGroupChangeEvent({
  //     group: this,
  //     newOpenType: this.currentOpenType,
  //     newResource: this.currentResource,
  //     oldOpenType,
  //     oldResource,
  //   }));
  //   this.setContextKeys();
  // }

  setContextKeys() {
    if (!this._resourceContext) {
      const getLanguageFromModel = (uri: URI) => {
        let result: string | null = null;
        const modelRef = this.documentModelManager.getModelReference(uri, 'resourceContextKey');
        if (modelRef) {
          if (modelRef) {
            result = modelRef.instance.languageId;
          }
          modelRef.dispose();
        }
        return result;
      };
      this._resourceContext = new ResourceContextKey(this.contextKeyService, (uri: URI) => {
        const res = getLanguageFromModel(uri);
        if (res) {
          return res!;
        } else {
          return getLanguageFromModel(uri);
        }
      });
      this._diffResourceContextKey = new ResourceContextKey(
        this.contextKeyService,
        (uri: URI) => {
          const res = getLanguageFromModel(uri);
          if (res) {
            return res!;
          } else {
            return getLanguageFromModel(uri);
          }
        },
        'diffResource',
      );
      this._editorLangIDContextKey = this.contextKeyService.createKey<string>('editorLangId', '');
      this._isInDiffEditorContextKey = this.contextKeyService.createKey<boolean>('isInDiffEditor', false);
      this._isInDiffRightEditorContextKey = this.contextKeyService.createKey<boolean>('isInDiffRightEditor', false);
      this._isInEditorComponentContextKey = this.contextKeyService.createKey<boolean>('inEditorComponent', false);
    }
    if (this.currentOrPreviousFocusedEditor && this.currentOrPreviousFocusedEditor.currentUri) {
      this._resourceContext.set(this.currentOrPreviousFocusedEditor.currentUri);
      if (this.currentOrPreviousFocusedEditor.currentDocumentModel) {
        this._editorLangIDContextKey.set(this.currentOrPreviousFocusedEditor.currentDocumentModel.languageId);
      }
    } else if (this.currentEditor && this.currentEditor.currentUri) {
      this._resourceContext.set(this.currentEditor.currentUri);
      if (this.currentEditor.currentDocumentModel) {
        this._editorLangIDContextKey.set(this.currentEditor.currentDocumentModel.languageId);
      }
    } else {
      if (this.currentResource) {
        this._resourceContext.set(this.currentResource.uri);
      } else {
        this._resourceContext.reset();
      }
      this._editorLangIDContextKey.reset();
    }
    this._isInDiffEditorContextKey.set(this.isDiffEditorMode());
    // 没有 focus 的时候默认添加在 RightDiffEditor
    this._isInDiffRightEditorContextKey.set(this.isDiffEditorMode());
    this._isInEditorComponentContextKey.set(this.isComponentMode());
    if (this.isDiffEditorMode()) {
      this._diffResourceContextKey.set(this.currentResource?.uri);
    }
    this.updateContextKeyWhenDiffEditorChangesFocus();
  }

  private updateContextKeyWhenDiffEditorChangesFocus() {
    if (this.updateContextKeyWhenEditorChangesFocusDisposer || !this.diffEditor) {
      return;
    }
    const emitIfNoEditorFocused = () => {
      if (!this.currentFocusedEditor) {
        this.setContextKeys();
        this._onDidEditorFocusChange.fire();
      }
    };
    this.updateContextKeyWhenEditorChangesFocusDisposer = new Disposable(
      this.diffEditor.modifiedEditor.onFocus(() => {
        this._currentOrPreviousFocusedEditor = this.diffEditor.modifiedEditor;
        this.setContextKeys();
        this._onDidEditorFocusChange.fire();
      }),
      this.diffEditor.originalEditor.onFocus(() => {
        this._currentOrPreviousFocusedEditor = this.diffEditor.originalEditor;
        this.setContextKeys();
        this._onDidEditorFocusChange.fire();
      }),
      this.codeEditor.onFocus(() => {
        this._currentOrPreviousFocusedEditor = this.codeEditor;
        this.setContextKeys();
        this._onDidEditorFocusChange.fire();
      }),
      this.codeEditor.onBlur(emitIfNoEditorFocused),
      this.diffEditor.originalEditor.onBlur(emitIfNoEditorFocused),
      this.diffEditor.modifiedEditor.onBlur(emitIfNoEditorFocused),
    );
    this.addDispose(this.updateContextKeyWhenEditorChangesFocusDisposer);
  }

  get contextKeyService() {
    if (!this._contextKeyService) {
      this._contextKeyService = this.workbenchEditorService.editorContextKeyService.createScoped();
    }
    return this._contextKeyService;
  }

  get index(): number {
    return this.workbenchEditorService.sortedEditorGroups.indexOf(this);
  }

  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    if (e.payload.decoration.dirty) {
      if (this.previewURI && this.previewURI.isEqual(e.payload.uri)) {
        this.pinPreviewed();
      }
    }
    const existingResource = this.resources.find((r) => r.uri.isEqual(e.payload.uri));
    if (existingResource) {
      this.notifyTabChanged();
    }
  }

  @OnEvent(ResourceOpenTypeChangedEvent)
  oResourceOpenTypeChangedEvent(e: ResourceOpenTypeChangedEvent) {
    const uri = e.payload;
    if (this.cachedResourcesOpenTypes.has(uri.toString())) {
      this.cachedResourcesOpenTypes.delete(uri.toString());
    }
    if (this.currentResource && this.currentResource.uri.isEqual(uri)) {
      this._currentOpenType = null;
      this.notifyBodyChanged();
      this.displayResourceComponent(this.currentResource, {});
    }
  }

  @OnEvent(RegisterEditorComponentEvent)
  async onRegisterEditorComponentEvent() {
    if (this.currentResource) {
      const openTypes = await this.editorComponentRegistry.resolveEditorComponent(this.currentResource);
      this.availableOpenTypes = openTypes;
      this.cachedResourcesOpenTypes.set(this.currentResource.uri.toString(), openTypes);
    }
  }

  pinPreviewed(uri?: URI) {
    const previous = this.previewURI;
    if (uri === undefined) {
      this.previewURI = null;
    } else if (this.previewURI && this.previewURI.isEqual(uri)) {
      this.previewURI = null;
    }
    if (previous !== this.previewURI) {
      this.notifyTabChanged();
    }
  }

  private notifyTabChanged() {
    if (this._restoringState) {
      return;
    }
    this._onDidEditorGroupTabChanged.fire();
  }

  private notifyBodyChanged() {
    this._onDidEditorGroupBodyChanged.fire();
  }

  private notifyTabLoading(resource: IResource) {
    this._onDidEditorGroupContentLoading.fire(resource);
  }

  get currentEditor(): IEditor | null {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        return this.codeEditor;
      } else if (this.currentOpenType.type === 'diff') {
        return this.diffEditor.modifiedEditor;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  get currentOrPreviousFocusedEditor(): IEditor | null {
    return this._currentOrPreviousFocusedEditor || this.currentEditor;
  }

  get currentFocusedEditor() {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        if (this.codeEditor.monacoEditor.hasWidgetFocus()) {
          return this.codeEditor;
        }
      } else if (this.currentOpenType.type === 'diff') {
        if (this.diffEditor.modifiedEditor.monacoEditor.hasTextFocus()) {
          return this.diffEditor.modifiedEditor;
        } else if (this.diffEditor.originalEditor.monacoEditor.hasTextFocus()) {
          return this.diffEditor.originalEditor;
        }
        if (this.diffEditor.modifiedEditor.monacoEditor.hasWidgetFocus()) {
          return this.diffEditor.modifiedEditor;
        } else if (this.diffEditor.originalEditor.monacoEditor.hasWidgetFocus()) {
          return this.diffEditor.originalEditor;
        }
      }
    }
    return null;
  }

  get currentCodeEditor(): ICodeEditor | null {
    if (this.currentOpenType) {
      if (this.currentOpenType.type === 'code') {
        return this.codeEditor;
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  createEditor(dom: HTMLElement) {
    this.codeEditor = this.collectionService.createCodeEditor(
      dom,
      {},
      {
        [ServiceNames.CONTEXT_KEY_SERVICE]: (this.contextKeyService as any).contextKeyService,
      },
    );
    setTimeout(() => {
      this.codeEditor.layout();
    });
    this.toDispose.push(
      this.codeEditor.onCursorPositionChanged((e) => {
        this._onCurrentEditorCursorChange.fire(e);
      }),
    );
    this.toDispose.push(
      this.codeEditor.onSelectionsChanged((e) => {
        if (this.currentOpenType && this.currentOpenType.type === 'code') {
          this.eventBus.fire(
            new EditorSelectionChangeEvent({
              group: this,
              resource: this.currentResource!,
              selections: e.selections,
              source: e.source,
              editorUri: this.codeEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.toDispose.push(
      this.codeEditor.onVisibleRangesChanged((e) => {
        if (this.currentOpenType && this.currentOpenType.type === 'code') {
          this.eventBus.fire(
            new EditorVisibleChangeEvent({
              group: this,
              resource: this.currentResource!,
              visibleRanges: e,
              editorUri: this.codeEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.toDispose.push(
      this.codeEditor.onConfigurationChanged(() => {
        if (this.currentOpenType && this.currentOpenType.type === 'code') {
          this.eventBus.fire(
            new EditorConfigurationChangedEvent({
              group: this,
              resource: this.currentResource!,
              editorUri: this.codeEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.eventBus.fire(
      new CodeEditorDidVisibleEvent({
        groupName: this.name,
        type: 'code',
        editorId: this.codeEditor.getId(),
      }),
    );
    this.codeEditorReady.ready();
  }

  createDiffEditor(dom: HTMLElement) {
    this.diffEditor = this.collectionService.createDiffEditor(
      dom,
      {},
      {
        [ServiceNames.CONTEXT_KEY_SERVICE]: (this.contextKeyService as any).contextKeyService,
      },
    );
    setTimeout(() => {
      this.diffEditor.layout();
    });
    // 这里应该还要加上 originalEditor 的相关监听，目前为了避免复杂度，先不放
    this.toDispose.push(
      this.diffEditor.modifiedEditor.onSelectionsChanged((e) => {
        if (this.currentOpenType && this.currentOpenType.type === 'diff') {
          this.eventBus.fire(
            new EditorSelectionChangeEvent({
              group: this,
              resource: this.currentResource!,
              selections: e.selections,
              source: e.source,
              editorUri: this.diffEditor.modifiedEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.toDispose.push(
      this.diffEditor.modifiedEditor.onVisibleRangesChanged((e) => {
        if (this.currentOpenType && this.currentOpenType.type === 'diff') {
          this.eventBus.fire(
            new EditorVisibleChangeEvent({
              group: this,
              resource: this.currentResource!,
              visibleRanges: e,
              editorUri: this.diffEditor.modifiedEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.toDispose.push(
      this.diffEditor.modifiedEditor.onConfigurationChanged(() => {
        if (this.currentOpenType && this.currentOpenType.type === 'diff') {
          this.eventBus.fire(
            new EditorConfigurationChangedEvent({
              group: this,
              resource: this.currentResource!,
              editorUri: this.diffEditor.modifiedEditor.currentUri!,
            }),
          );
        }
      }),
    );
    this.eventBus.fire(
      new CodeEditorDidVisibleEvent({
        groupName: this.name,
        type: 'diff',
        editorId: this.diffEditor.modifiedEditor.getId(),
      }),
    );
    this.diffEditorReady.ready();
  }

  async split(action: EditorGroupSplitAction, uri: URI, options?: IResourceOpenOptions) {
    const editorGroup = this.workbenchEditorService.createEditorGroup();
    const direction =
      action === EditorGroupSplitAction.Left || action === EditorGroupSplitAction.Right
        ? SplitDirection.Horizontal
        : SplitDirection.Vertical;
    const before = action === EditorGroupSplitAction.Left || action === EditorGroupSplitAction.Top ? true : false;
    this.grid.split(direction, editorGroup, before);

    // 对于同一个编辑器分栏的场景，希望保留原本的滚动状态，与 VS Code 保持一致
    if (options && !options.scrollTop) {
      options.scrollTop = this.currentEditor?.monacoEditor.getScrollTop();
    }
    if (options && !options.scrollLeft) {
      options.scrollLeft = this.currentEditor?.monacoEditor.getScrollLeft();
    }

    if (options && !options?.range) {
      const selection = this.currentCodeEditor?.monacoEditor.getSelection();
      if (selection) {
        options.range = new monaco.Range(
          selection.startLineNumber,
          selection.startColumn,
          selection.endLineNumber,
          selection.endColumn,
        );
      }
    }

    return editorGroup.open(uri, { ...options, preview: false });
  }

  async open(uri: URI, options: IResourceOpenOptions = {}): Promise<IOpenResourceResult> {
    if (uri.scheme === Schemas.file) {
      // 只记录 file 类型的
      this.recentFilesManager.setMostRecentlyOpenedFile!(uri.withoutFragment().toString());
    }
    if (options && options.split) {
      return this.split(options.split, uri, Object.assign({}, options, { split: undefined, preview: false }));
    }
    if (!this.openingPromise.has(uri.toString())) {
      const promise = this.doOpen(uri, options);
      this.openingPromise.set(uri.toString(), promise);
      promise.then(
        () => {
          this.openingPromise.delete(uri.toString());
        },
        () => {
          this.openingPromise.delete(uri.toString());
        },
      );
    }
    const previewMode =
      this.preferenceService.get('editor.previewMode') && (isUndefinedOrNull(options.preview) ? true : options.preview);
    if (!previewMode) {
      this.openingPromise.get(uri.toString())!.then(() => {
        this.pinPreviewed(uri);
      });
    }
    return this.openingPromise.get(uri.toString())!;
  }

  async pin(uri: URI) {
    return this.pinPreviewed(uri);
  }

  async doOpen(
    uri: URI,
    options: IResourceOpenOptions = {},
  ): Promise<{ group: IEditorGroup; resource: IResource } | false> {
    if (!this.resourceService.handlesUri(uri)) {
      this.openerService.open(uri);
      return false;
    }
    let resourceReady: Deferred<void> | undefined;
    try {
      const previewMode =
        this.preferenceService.get('editor.previewMode') &&
        (isUndefinedOrNull(options.preview) ? true : options.preview);
      if (this.currentResource && this.currentResource.uri.isEqual(uri)) {
        // 就是当前打开的resource
        if (options.focus && this.currentEditor) {
          this._domNode?.focus();
          this.currentEditor.monacoEditor.focus();
        }
        if (options.range && this.currentEditor) {
          this.currentEditor.monacoEditor.setSelection(options.range as monaco.IRange);
          this.currentEditor.monacoEditor.revealRangeInCenterIfOutsideViewport(options.range as monaco.IRange, 0);
        }
        if ((options && options.disableNavigate) || (options && options.backend)) {
          // no-op
        } else {
          this.locateInFileTree(uri);
        }
        this.notifyTabChanged();
        return {
          group: this,
          resource: this.currentResource,
        };
      } else {
        const oldOpenType = this._currentOpenType;
        const oldResource = this._currentResource;
        let resource: IResource | null | undefined = this.resources.find((r) => r.uri.toString() === uri.toString());
        if (!resource) {
          // open new resource
          resource = await this.resourceService.getResource(uri);
          if (!resource) {
            throw new Error('This uri cannot be opened!: ' + uri);
          }
          if (resource.deleted) {
            if (options.deletedPolicy === 'fail') {
              throw new Error('resource deleted ' + uri);
            } else if (options.deletedPolicy === 'skip') {
              return false;
            }
          }
          if (options && options.label) {
            resource.name = options.label;
          }
          let replaceResource: IResource | null = null;
          if (options && options.index !== undefined && options.index < this.resources.length) {
            replaceResource = this.resources[options.index];
            this.resources.splice(options.index, 0, resource);
          } else {
            if (this.currentResource) {
              const currentIndex = this.resources.indexOf(this.currentResource);
              this.resources.splice(currentIndex + 1, 0, resource);
              replaceResource = this.currentResource;
            } else {
              this.resources.push(resource);
            }
          }
          if (previewMode) {
            if (this.previewURI) {
              await this.close(this.previewURI, { treatAsNotCurrent: true });
            }
            this.previewURI = resource.uri;
          }
          if (options.replace && replaceResource) {
            await this.close(replaceResource.uri, { treatAsNotCurrent: true });
          }
        }
        if (options.backend) {
          this.notifyTabChanged();
          return false;
        }
        if (oldResource && this.resourceOpenHistory[this.resourceOpenHistory.length - 1] !== oldResource.uri) {
          this.resourceOpenHistory.push(oldResource.uri);
          const oldResourceSelections = this.currentCodeEditor?.getSelections();
          if (oldResourceSelections && oldResourceSelections.length > 0) {
            this.recentFilesManager.updateMostRecentlyOpenedFile(oldResource.uri.toString(), {
              lineNumber: oldResourceSelections[0].selectionStartLineNumber,
              column: oldResourceSelections[0].selectionStartColumn,
            });
          }
        }
        this._currentResource = resource;
        this.notifyTabChanged();
        this._currentOpenType = null;
        this.notifyBodyChanged();

        // 只有真正打开的文件才会走到这里，backend模式的只更新了tab，文件内容并未加载
        const reportTimer = this.reporterService.time(REPORT_NAME.EDITOR_REACTIVE);
        resourceReady = new Deferred<void>();
        this.resourceStatus.set(resource, resourceReady.promise);
        // 超过60ms loading时间的才展示加载
        const delayTimer = setTimeout(() => {
          this.notifyTabLoading(resource!);
        }, 60);
        await this.displayResourceComponent(resource, options);
        clearTimeout(delayTimer);
        resourceReady.resolve();
        reportTimer.timeEnd(resource.uri.toString());
        this._currentOrPreviousFocusedEditor = this.currentEditor;
        this._onDidEditorFocusChange.fire();
        this.setContextKeys();
        this.eventBus.fire(
          new EditorGroupOpenEvent({
            group: this,
            resource,
          }),
        );
        if ((options && options.disableNavigate) || (options && options.backend)) {
          // no-op
        } else {
          this.locateInFileTree(uri);
        }
        this.eventBus.fire(
          new EditorGroupChangeEvent({
            group: this,
            newOpenType: this.currentOpenType,
            newResource: this.currentResource,
            oldOpenType,
            oldResource,
          }),
        );
        return {
          group: this,
          resource,
        };
      }
    } catch (e) {
      getDebugLogger().error(e);
      resourceReady && resourceReady.reject();
      if (!isEditorError(e, EditorTabChangedError)) {
        this.messageService.error(formatLocalize('editor.failToOpen', uri.displayName, e.message), [], true);
      }
      return false;
      // todo 给用户显示error
    }
  }

  private locateInFileTree(uri: URI) {
    if (this.explorerAutoRevealConfig) {
      this.commands.tryExecuteCommand(FILE_COMMANDS.LOCATION.id, uri);
    }
  }

  async openUris(uris: URI[]): Promise<void> {
    for (const uri of uris) {
      await this.open(uri);
    }
  }

  async getDocumentModelRef(uri: URI): Promise<IEditorDocumentModelRef> {
    if (!this.holdDocumentModelRefs.has(uri.toString())) {
      this.holdDocumentModelRefs.set(
        uri.toString(),
        await this.documentModelManager.createModelReference(uri, 'editor-group-' + this.name),
      );
    }
    return this.holdDocumentModelRefs.get(uri.toString())!;
  }

  disposeDocumentRef(uri: URI) {
    if (uri.scheme === 'diff') {
      const query = uri.getParsedQuery();
      this.doDisposeDocRef(new URI(query.original));
      this.doDisposeDocRef(new URI(query.modified));
    } else {
      this.doDisposeDocRef(uri);
    }
  }

  protected doDisposeDocRef(uri: URI) {
    if (this.holdDocumentModelRefs.has(uri.toString())) {
      this.holdDocumentModelRefs.get(uri.toString())!.dispose();
      this.holdDocumentModelRefs.delete(uri.toString());
    }
  }

  private async displayResourceComponent(resource: IResource, options: IResourceOpenOptions = {}) {
    const _resource = resource;
    const result = await this.resolveOpenType(resource, options);
    if (result) {
      const { activeOpenType, openTypes } = result;

      this.availableOpenTypes = openTypes;

      if (options.preserveFocus) {
        options.focus = false;
      }

      if (activeOpenType.type === 'code') {
        const documentRef = await this.getDocumentModelRef(resource.uri);
        await this.codeEditorReady.onceReady(async () => {
          await this.codeEditor.open(documentRef);

          if (options.range) {
            const range = new monaco.Range(
              options.range.startLineNumber!,
              options.range.startColumn!,
              options.range.endLineNumber!,
              options.range.endColumn!,
            );
            this.codeEditor.monacoEditor.setSelection(range);
            // 这里使用 queueMicrotask 在下一次事件循环时将编辑器滚动到指定位置
            // 原因是在打开新文件的情况下
            // setModel 后立即调用 revealRangeInCenterIfOutsideViewport 编辑器无法获取到 viewport 宽高
            // 导致无法正确计算滚动位置
            // 相比 setTimeout, queueMicrotask 优先级更高
            // ref: https://developer.mozilla.org/zh-CN/docs/Web/API/queueMicrotask
            queueMicrotask(() => {
              this.codeEditor.monacoEditor.revealRangeInCenterIfOutsideViewport(range, 0);
            });
          }

          // 同上
          queueMicrotask(() => {
            if (options.scrollTop) {
              this.codeEditor.monacoEditor.setScrollTop(options.scrollTop!);
            }
            if (options.scrollLeft) {
              this.codeEditor.monacoEditor.setScrollLeft(options.scrollLeft!);
            }
          });

          if (options.focus) {
            this._domNode?.focus();
            // monaco 编辑器的 focus 多了一步检查，由于此时其实对应编辑器的 dom 的 display 为 none （需要等 React 下一次渲染才会改变为 block）,
            // 会引起 document.activeElement !== editor.textArea.domNode，进而会导致focus失败
            // 需要等待真正 append 之后再
            const disposer = this.eventBus.on(CodeEditorDidVisibleEvent, (e) => {
              if (e.payload.groupName === this.name && e.payload.type === 'code') {
                disposer.dispose();
                // 此处必须多做一些检查以免不必要的 focus
                if (this.disposed) {
                  return;
                }
                if (this !== this.workbenchEditorService.currentEditorGroup) {
                  return;
                }
                if (this.currentEditor === this.codeEditor && this.codeEditor.currentUri?.isEqual(resource.uri)) {
                  try {
                    this.codeEditor.focus();
                  } catch (e) {
                    // noop
                  }
                }
              }
            });
          }
        });
        // 可能在diff Editor中修改导致为脏
        if (documentRef.instance!.dirty) {
          this.pinPreviewed(resource.uri);
        }
      } else if (activeOpenType.type === 'diff') {
        const diffResource = resource as IDiffResource;
        const [original, modified] = await Promise.all([
          this.getDocumentModelRef(diffResource.metadata!.original),
          this.getDocumentModelRef(diffResource.metadata!.modified),
        ]);
        await this.diffEditorReady.onceReady(async () => {
          await this.diffEditor.compare(original, modified, options, resource.uri);
          if (options.focus) {
            this._domNode?.focus();
            // 理由见上方 codeEditor.focus 部分

            const disposer = this.eventBus.on(CodeEditorDidVisibleEvent, (e) => {
              if (e.payload.groupName === this.name && e.payload.type === 'diff') {
                disposer.dispose();
                if (this.disposed) {
                  return;
                }
                if (this !== this.workbenchEditorService.currentEditorGroup) {
                  return;
                }
                if (this.currentEditor === this.diffEditor.modifiedEditor) {
                  try {
                    this.diffEditor.focus();
                  } catch (e) {
                    // noop
                  }
                }
              }
            });
          }
        });
      } else if (activeOpenType.type === 'component') {
        const component = this.editorComponentRegistry.getEditorComponent(activeOpenType.componentId as string);
        const initialProps = this.editorComponentRegistry.getEditorInitialProps(activeOpenType.componentId as string);
        if (!component) {
          throw new Error('Cannot find Editor Component with id: ' + activeOpenType.componentId);
        } else {
          this.activateComponentsProps.set(component, initialProps);
          if (component.renderMode === EditorComponentRenderMode.ONE_PER_RESOURCE) {
            const openedResources = this.activeComponents.get(component) || [];
            const index = openedResources.findIndex((r) => r.uri.toString() === resource.uri.toString());
            if (index === -1) {
              openedResources.push(resource);
            }
            this.activeComponents.set(component, openedResources);
          } else if (component.renderMode === EditorComponentRenderMode.ONE_PER_GROUP) {
            this.activeComponents.set(component, [resource]);
          } else if (component.renderMode === EditorComponentRenderMode.ONE_PER_WORKBENCH) {
            const promises: Promise<any>[] = [];
            this.workbenchEditorService.editorGroups.forEach((g) => {
              if (g === this) {
                return;
              }
              const r = g.resources.find((r) => r.uri.isEqual(resource.uri));
              if (r) {
                promises.push(g.close(r.uri));
              }
            });
            await Promise.all(promises).catch(getDebugLogger().error);
            this.activeComponents.set(component, [resource]);
          }
        }
        // 打开非编辑器的component时需要手动触发
        this._onCurrentEditorCursorChange.fire({
          position: null,
          selectionLength: 0,
        });
      } else {
        return; // other type not handled
      }

      if (_resource !== this.currentResource) {
        throw new EditorTabChangedError(); // 在打开过程中已经改变了
      }

      this._currentOpenType = activeOpenType;
      this.notifyBodyChanged();

      if (
        (this._codeEditorPendingLayout && activeOpenType.type === 'code') ||
        (this._diffEditorPendingLayout && activeOpenType.type === 'diff')
      ) {
        this.doLayoutEditors();
      }

      this.cachedResourcesActiveOpenTypes.set(resource.uri.toString(), activeOpenType);
    }
  }

  private async resolveOpenType(
    resource: IResource,
    options: IResourceOpenOptions,
  ): Promise<{ activeOpenType: IEditorOpenType; openTypes: IEditorOpenType[] } | null> {
    const openTypes =
      this.cachedResourcesOpenTypes.get(resource.uri.toString()) ||
      (await this.editorComponentRegistry.resolveEditorComponent(resource));
    const activeOpenType = findSuitableOpenType(
      openTypes,
      this.cachedResourcesActiveOpenTypes.get(resource.uri.toString()),
      options.forceOpenType,
    );
    this.cachedResourcesOpenTypes.set(resource.uri.toString(), openTypes);
    return { activeOpenType, openTypes };
  }

  public async close(
    uri: URI,
    {
      treatAsNotCurrent,
      force,
    }: {
      treatAsNotCurrent?: boolean;
      force?: boolean;
    } = {},
  ) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resource = this.resources[index];
      if (!force) {
        if (!(await this.shouldClose(resource))) {
          return;
        }
      }
      this.resources.splice(index, 1);
      this.eventBus.fire(
        new EditorGroupCloseEvent({
          group: this,
          resource,
        }),
      );
      if (this.previewURI && this.previewURI.isEqual(uri)) {
        this.previewURI = null;
      }
      // 优先打开用户打开历史中的uri,
      // 如果历史中的不可打开，打开去除当前关闭目标uri后相同位置的uri, 如果没有，则一直往前找到第一个可用的uri
      if (resource === this.currentResource && !treatAsNotCurrent) {
        let nextUri: URI | undefined;
        while (this.resourceOpenHistory.length > 0) {
          if (
            this.resources.findIndex((r) => r.uri === this.resourceOpenHistory[this.resourceOpenHistory.length - 1]) !==
            -1
          ) {
            nextUri = this.resourceOpenHistory.pop();
            break;
          } else {
            this.resourceOpenHistory.pop();
          }
        }
        if (nextUri) {
          this.open(nextUri);
        } else {
          let i = index;
          while (i > 0 && !this.resources[i]) {
            i--;
          }
          if (this.resources[i]) {
            this.open(this.resources[i].uri);
          } else {
            this.backToEmpty();
          }
        }
      } else {
        this.notifyTabChanged();
      }
      for (const resources of this.activeComponents.values()) {
        const i = resources.indexOf(resource);
        if (i !== -1) {
          resources.splice(i, 1);
        }
      }
      this.disposeDocumentRef(uri);
    }
    if (this.resources.length === 0) {
      if (this.grid.parent) {
        // 当前不是最后一个 editor Group
        this.dispose();
      }
      this.availableOpenTypes = [];
    }
  }

  private async shouldClose(resource: IResource): Promise<boolean> {
    // TODO: 自定义打开方式如果存在保存能力，也要能阻止关闭
    const openedResources = this.workbenchEditorService.editorGroups.map((group) => group.resources);
    if (!(await this.resourceService.shouldCloseResource(resource, openedResources))) {
      return false;
    } else {
      let count = 0;
      for (const group of openedResources) {
        for (const res of group) {
          if (res.uri.isEqual(resource.uri)) {
            count++;
            if (count >= 2) {
              break;
            }
          }
        }
      }
      if (count <= 1) {
        this.resourceService.disposeResource(resource);
      }
      return true;
    }
  }

  private backToEmpty() {
    const oldOpenType = this._currentOpenType;
    const oldResource = this._currentResource;

    this._currentResource = null;
    this._currentOpenType = null;
    this.notifyTabChanged();
    this.notifyBodyChanged();
    this._currentOrPreviousFocusedEditor = null;
    this._onDidEditorFocusChange.fire();
    // 关闭最后一个时，应该发送一个 EditorGroupChangeEvent
    this.eventBus.fire(
      new EditorGroupChangeEvent({
        group: this,
        newOpenType: this.currentOpenType,
        newResource: this.currentResource,
        oldOpenType,
        oldResource,
      }),
    );
  }

  /**
   * 关闭全部
   */
  async closeAll() {
    for (const resource of this.resources) {
      if (!(await this.shouldClose(resource))) {
        return;
      }
    }
    const closed = this.resources.splice(0, this.resources.length);
    closed.forEach((resource) => {
      this.clearResourceOnClose(resource);
    });
    this.activeComponents.clear();
    if (this.workbenchEditorService.editorGroups.length > 1) {
      this.dispose();
    }
    this.previewURI = null;
    this.backToEmpty();
  }

  /**
   * 关闭已保存（非dirty）
   */
  async closeSaved() {
    const saved = this.resources.filter((r) => {
      const decoration = this.resourceService.getResourceDecoration(r.uri);
      if (!decoration || !decoration.dirty) {
        return true;
      }
    });
    for (const resource of saved) {
      if (!(await this.shouldClose(resource))) {
        return;
      }
    }
    for (const resource of saved) {
      await this.close(resource.uri);
    }
  }

  /**
   * 关闭向右的tab
   * @param uri
   */
  async closeToRight(uri: URI) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resourcesToClose = this.resources.slice(index + 1);
      for (const resource of resourcesToClose) {
        if (!(await this.shouldClose(resource))) {
          return;
        }
      }
      this.resources.splice(index + 1);
      for (const resource of resourcesToClose) {
        this.clearResourceOnClose(resource);
      }
      this.open(uri);
    }
  }

  clearResourceOnClose(resource: IResource) {
    this.eventBus.fire(
      new EditorGroupCloseEvent({
        group: this,
        resource,
      }),
    );
    for (const resources of this.activeComponents.values()) {
      const i = resources.indexOf(resource);
      if (i !== -1) {
        resources.splice(i, 1);
      }
    }
  }

  async closeOthers(uri: URI) {
    const index = this.resources.findIndex((r) => r.uri.toString() === uri.toString());
    if (index !== -1) {
      const resourcesToClose = this.resources.filter((v, i) => i !== index);
      for (const resource of resourcesToClose) {
        if (!(await this.shouldClose(resource))) {
          return;
        }
      }
      this.resources = [this.resources[index]];
      for (const resource of resourcesToClose) {
        this.clearResourceOnClose(resource);
      }
      await this.open(uri);
    }
  }

  /**
   * 当前打开的resource
   */
  get currentResource(): MaybeNull<IResource> {
    return this._currentResource;
  }

  get currentOpenType(): MaybeNull<IEditorOpenType> {
    return this._currentOpenType;
  }

  async changeOpenType(type: IEditorOpenType) {
    if (!this.currentResource) {
      return;
    }
    if (openTypeSimilar(type, this.currentOpenType!)) {
      return;
    }
    const oldOpenType = this.currentOpenType;
    await this.displayResourceComponent(this.currentResource!, { forceOpenType: type });
    this.eventBus.fire(
      new EditorGroupChangeEvent({
        group: this,
        newOpenType: this.currentOpenType,
        newResource: this.currentResource,
        oldOpenType,
        oldResource: this.currentResource,
      }),
    );
  }

  /**
   * 拖拽drop方法
   */
  public async dropUri(uri: URI, position: DragOverPosition, sourceGroup?: EditorGroup, targetResource?: IResource) {
    if (position !== DragOverPosition.CENTER) {
      await this.split(getSplitActionFromDragDrop(position), uri, { preview: false, focus: true });
    } else {
      // 扔在本体或者tab上
      if (!targetResource) {
        await this.open(uri, { preview: false, focus: true });
      } else {
        const targetIndex = this.resources.indexOf(targetResource);
        if (targetIndex === -1) {
          await this.open(uri, { preview: false, focus: true });
        } else {
          const sourceIndex = this.resources.findIndex((resource) => resource.uri.toString() === uri.toString());
          if (sourceIndex === -1) {
            await this.open(uri, {
              index: targetIndex,
              preview: false,
            });
          } else {
            // just move
            const sourceResource = this.resources[sourceIndex];
            if (sourceIndex > targetIndex) {
              this.resources.splice(sourceIndex, 1);
              this.resources.splice(targetIndex, 0, sourceResource);
              await this.open(uri, { preview: false });
            } else if (sourceIndex < targetIndex) {
              this.resources.splice(targetIndex + 1, 0, sourceResource);
              this.resources.splice(sourceIndex, 1);
              await this.open(uri, { preview: false });
            }
          }
        }
      }
    }

    if (sourceGroup) {
      if (sourceGroup !== this) {
        // 从其他group拖动过来
        await sourceGroup.close(uri);
      } else if (position !== DragOverPosition.CENTER) {
        // split行为
        await this.close(uri);
      }
    }
  }

  gainFocus() {
    this.workbenchEditorService.setCurrentGroup(this);
  }

  focus() {
    this.gainFocus();
    if (this.currentOpenType && this.currentOpenType.type === 'code') {
      this.codeEditor.focus();
    }
    if (this.currentOpenType && this.currentOpenType.type === 'diff') {
      this.diffEditor.focus();
    }
  }

  dispose() {
    this.grid.dispose();
    this.workbenchEditorService.removeGroup(this);
    super.dispose();
    this.codeEditor && this.codeEditor.dispose();
    this.diffEditor && this.diffEditor.dispose();
    this.toDispose.forEach((disposable) => disposable.dispose());
    this.eventBus.fire(
      new EditorGroupDisposeEvent({
        group: this,
      }),
    );
  }

  getState(): IEditorGroupState {
    const couldRevive = (r: IResource): boolean => !!(r.supportsRevive && !r.deleted);

    const uris = this.resources.filter(couldRevive).map((r) => r.uri.toString());
    return {
      uris,
      current:
        this.currentResource && couldRevive(this.currentResource) ? this.currentResource.uri.toString() : undefined,
      previewIndex: this.previewURI ? uris.indexOf(this.previewURI.toString()) : -1,
    };
  }

  isCodeEditorMode() {
    return !!this.currentOpenType && this.currentOpenType.type === 'code';
  }

  isDiffEditorMode() {
    return !!this.currentOpenType && this.currentOpenType.type === 'diff';
  }

  isComponentMode() {
    return !!this.currentOpenType && this.currentOpenType.type === 'component';
  }

  async restoreState(state: IEditorGroupState) {
    this._restoringState = true;
    this.previewURI = state.uris[state.previewIndex] ? null : new URI(state.uris[state.previewIndex]);
    for (const uri of state.uris) {
      await this.doOpen(new URI(uri), { disableNavigate: true, backend: true, preview: false, deletedPolicy: 'skip' });
    }
    let targetUri: URI | undefined;
    if (state.current) {
      targetUri = new URI(state.current);
    } else {
      if (state.uris.length > 0) {
        targetUri = new URI(state.uris[state.uris.length - 1]!);
      }
    }
    if (targetUri) {
      if (!(await this.open(targetUri, { deletedPolicy: 'skip' }))) {
        if (this.resources[0]) {
          await this.open(this.resources[0].uri);
        }
      }
    }
    this._restoringState = false;
    this.notifyTabChanged();
  }

  async saveAll(includeUntitled?: boolean, reason?: SaveReason) {
    for (const r of this.resources) {
      // 不保存无标题文件
      if (!includeUntitled && r.uri.scheme === Schemas.untitled) {
        continue;
      }
      await this.saveResource(r, reason);
    }
  }

  async saveResource(resource: IResource, reason: SaveReason = SaveReason.Manual) {
    // 尝试使用 openType 提供的保存方法保存
    if (await this.saveByOpenType(resource, reason)) {
      return;
    }

    // 否则使用 document 进行保存 (如果有)
    const docRef = this.documentModelManager.getModelReference(resource.uri);
    if (docRef) {
      if (docRef.instance.dirty) {
        await docRef.instance.save(undefined, reason);
      }
      docRef.dispose();
    }
  }

  async saveByOpenType(resource: IResource, reason: SaveReason): Promise<boolean> {
    const openType = this.cachedResourcesActiveOpenTypes.get(resource.uri.toString());
    if (openType && openType.saveResource) {
      try {
        await openType.saveResource(resource, reason);
        return true;
      } catch (e) {
        this.logger.error(e);
      }
    }
    return false;
  }

  async saveCurrent(reason: SaveReason = SaveReason.Manual) {
    const resource = this.currentResource;
    if (!resource) {
      return;
    }
    if (await this.saveByOpenType(resource, reason)) {
      return;
    }
    if (this.currentEditor) {
      return this.currentEditor.save();
    }
  }

  hasDirty(): boolean {
    for (const r of this.resources) {
      const docRef = this.documentModelManager.getModelReference(r.uri);
      if (docRef) {
        const isDirty = docRef.instance.dirty;
        docRef.dispose();
        if (isDirty) {
          return true;
        }
      }
    }
    return false;
  }

  componentUndo() {
    const currentOpenType = this.currentOpenType;
    if (currentOpenType?.undo) {
      currentOpenType.undo(this.currentResource!);
    }
  }

  componentRedo() {
    const currentOpenType = this.currentOpenType;
    if (currentOpenType?.redo) {
      currentOpenType.redo(this.currentResource!);
    }
  }

  /**
   * 防止作为参数被抛入插件进程时出错
   */
  toJSON() {
    return {
      name: this.name,
    };
  }
}

function findSuitableOpenType(
  currentAvailable: IEditorOpenType[],
  prev: IEditorOpenType | undefined,
  forceOpenType?: IEditorOpenType,
) {
  if (forceOpenType) {
    return currentAvailable.find((p) => openTypeSimilar(p, forceOpenType)) || currentAvailable[0];
  } else if (prev) {
    return currentAvailable.find((p) => openTypeSimilar(p, prev)) || currentAvailable[0];
  }
  return currentAvailable[0];
}

function openTypeSimilar(a: IEditorOpenType, b: IEditorOpenType) {
  return a.type === b.type && (a.type !== 'component' || a.componentId === b.componentId);
}
