/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { Doc as YDoc, Map as YMap, YMapEvent, Text as YText } from 'yjs';

import { Autowired, INJECTOR_TOKEN, Inject, Injectable, Injector } from '@opensumi/di';
import { AppConfig, DisposableCollection } from '@opensumi/ide-core-browser';
import { Deferred, DisposableStore, ILogger, OnEvent, WithEventBus, uuid } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorDocumentModelCreationEvent,
  EditorDocumentModelRemovalEvent,
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { FileChangeEvent, FileChangeType, IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { ICodeEditor, ITextModel } from '@opensumi/ide-monaco';
import { ICSSStyleService } from '@opensumi/ide-theme';

import {
  CollaborationModuleContribution,
  CollaborationServiceForClientPath,
  DEFAULT_COLLABORATION_PORT,
  ICollaborationService,
  ICollaborationServiceForClient,
  ROOM_NAME,
  UserInfo,
  Y_REMOTE_SELECTION,
  Y_REMOTE_SELECTION_HEAD,
} from '../common';

import { getColorByClientID } from './color';
import { CursorWidgetRegistry } from './cursor-widget';
import { TextModelBinding } from './textmodel-binding';

import './styles.less';

@Injectable()
export class CollaborationService extends WithEventBus implements ICollaborationService {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(ICSSStyleService)
  private cssManager: ICSSStyleService;

  @Autowired(IEditorDocumentModelService)
  private docModelManager: IEditorDocumentModelService;

  @Autowired(IFileServiceClient)
  protected readonly fileServiceClient: IFileServiceClient;

  @Autowired(AppConfig)
  private appConfig: AppConfig;

  private clientIDStyleAddedSet: Set<number> = new Set();

  private cursorRegistryMap: Map<ICodeEditor, CursorWidgetRegistry> = new Map();

  private userInfo: UserInfo;

  private yDoc: YDoc;

  private yWebSocketProvider: WebsocketProvider;

  private yTextMap: YMap<YText>;

  private bindingMap: Map<string, TextModelBinding> = new Map();

  private yMapReadyMap: Map<string, Deferred<void>> = new Map();

  private bindingReadyMap: Map<string, Deferred<void>> = new Map();

  protected readonly toDisposableCollection: DisposableCollection = new DisposableCollection();
  protected cssStyleSheetsDisposables = new DisposableStore();

  private yMapObserver = (event: YMapEvent<YText>) => {
    const changes = event.changes.keys;
    changes.forEach((change, key) => {
      if (change.action === 'add') {
        const { yMapReady } = this.getDeferred(key);
        const binding = this.getBinding(key);
        if (binding) {
          const text = this.yTextMap.get(key)!;
          binding.changeYText(text);
        }
        yMapReady.resolve();
      } else if (change.action === 'delete') {
        this.resetDeferredYMapKey(key);
      }
    });
  };

  constructor(@Inject(CollaborationServiceForClientPath) private readonly backService: ICollaborationServiceForClient) {
    super();
  }

  initialize() {
    /**
     * 优先使用 appConfig.collaborationWsPath 配置
     * 如果没有该配置才根据 wsPath 去转换端口，端口可以用 collaborationOpts.port 配置
     */
    const { collaborationWsPath, wsPath, collaborationOptions } = this.appConfig;
    let serverUrl: string | undefined = collaborationWsPath;

    if (!serverUrl) {
      const path = new URL(wsPath.toString());
      path.port = String(collaborationOptions?.port ?? DEFAULT_COLLABORATION_PORT);

      serverUrl = path.toString();
    }

    this.yDoc = new YDoc();
    this.yTextMap = this.yDoc.getMap();

    this.yWebSocketProvider = new WebsocketProvider(serverUrl.toString(), ROOM_NAME, this.yDoc);

    this.yTextMap.observe(this.yMapObserver);

    this.yWebSocketProvider.awareness.on('update', this.updateCSSManagerWhenAwarenessUpdated);
  }

  registerUserInfo() {
    if (this.userInfo === undefined) {
      // fallback
      this.userInfo = {
        id: uuid().slice(0, 4),
        nickname: `${uuid().slice(0, 4)}`,
      };
    }
    // add userInfo to awareness field
    this.yWebSocketProvider.awareness.setLocalStateField('user-info', this.userInfo);
  }

  initFileWatch() {
    this.toDisposableCollection.push(
      this.fileServiceClient.onFilesChanged((e) => {
        this.handleFileChange(e);
      }),
    );
  }

  destroy() {
    this.yWebSocketProvider.awareness.off('update', this.updateCSSManagerWhenAwarenessUpdated);
    this.cssStyleSheetsDisposables.clear();
    this.yTextMap.unobserve(this.yMapObserver);
    this.yWebSocketProvider.disconnect();
    this.bindingMap.forEach((binding) => binding.destroy());
    this.toDisposableCollection.dispose();
  }

  registerContribution(contribution: CollaborationModuleContribution) {
    if (this.userInfo) {
      throw new Error('User info is already registered');
    }

    if (contribution.info) {
      this.userInfo = contribution.info;
    }
  }

  undoOnFocusedTextModel() {
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    if (uri && this.bindingMap.has(uri)) {
      this.bindingMap.get(uri)!.undo();
    }
  }

  redoOnFocusedTextModel() {
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    if (uri && this.bindingMap.has(uri)) {
      this.bindingMap.get(uri)!.redo();
    }
  }

  private getDeferred(uri: string) {
    if (!this.bindingReadyMap.has(uri)) {
      this.bindingReadyMap.set(uri, new Deferred());
    }
    if (!this.yMapReadyMap.has(uri)) {
      this.yMapReadyMap.set(uri, new Deferred());
    }

    const bindingReady = this.bindingReadyMap.get(uri)!;
    const yMapReady = this.yMapReadyMap.get(uri)!;

    return { bindingReady, yMapReady };
  }

  private resetDeferredYMapKey(uri: string) {
    if (this.yMapReadyMap.has(uri)) {
      this.yMapReadyMap.set(uri, new Deferred());
    }
  }

  private resetDeferredBinding(uri: string) {
    if (this.bindingReadyMap.has(uri)) {
      this.bindingReadyMap.set(uri, new Deferred());
    }
  }

  private createAndSetBinding(uri: string, model: ITextModel): TextModelBinding {
    const cond = this.bindingMap.has(uri);

    if (!cond) {
      const binding = this.injector.get(TextModelBinding, [
        this.yTextMap.get(uri)!, // only be called when entry of yMap is ready
        model,
        this.yWebSocketProvider.awareness,
      ]);
      this.bindingMap.set(uri, binding);
      return binding;
    } else {
      return this.bindingMap.get(uri)!;
    }
  }

  private getBinding(uri: string) {
    const cond = this.bindingMap.has(uri);

    if (cond) {
      return this.bindingMap.get(uri)!;
    } else {
      return null;
    }
  }

  private removeBinding(uri: string) {
    const binding = this.bindingMap.get(uri);

    if (binding) {
      binding.destroy();
      this.bindingMap.delete(uri);
    }
  }

  public getCursorWidgetRegistry(editor: ICodeEditor) {
    return this.cursorRegistryMap.get(editor);
  }

  private updateCSSManagerWhenAwarenessUpdated = (changes: {
    added: number[];
    updated: number[];
    removed: number[];
  }) => {
    if (changes.added.length > 0) {
      changes.added.forEach((clientID) => {
        if (!this.clientIDStyleAddedSet.has(clientID)) {
          const [foregroundColor, backgroundColor] = getColorByClientID(clientID);
          this.cssStyleSheetsDisposables.add(
            this.cssManager.addClass(`${Y_REMOTE_SELECTION}-${clientID}`, {
              backgroundColor,
              opacity: '0.25',
              color: foregroundColor,
            }),
          );
          this.cssStyleSheetsDisposables.add(
            this.cssManager.addClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}`, {
              position: 'absolute',
              borderLeft: `${backgroundColor} solid 2px`,
              borderBottom: `${backgroundColor} solid 2px`,
              borderTop: `${backgroundColor} solid 2px`,
              height: '100%',
              boxSizing: 'border-box',
            }),
          );
          this.cssStyleSheetsDisposables.add(
            this.cssManager.addClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}::after`, {
              position: 'absolute',
              content: ' ',
              border: `3px solid ${backgroundColor}`,
              left: '-4px',
              top: '-5px',
            }),
          );
          this.clientIDStyleAddedSet.add(clientID);
        }
      });
    }
  };

  private handleFileChange(e: FileChangeEvent) {
    e.forEach((change) => {
      // 只有从文件系统更新，并且窗口未打开情况，才重置 yTextMap
      if (change.type === FileChangeType.UPDATED && !this.bindingMap.get(change.uri) && this.yTextMap.get(change.uri)) {
        this.yTextMap.delete(change.uri);
        this.resetDeferredYMapKey(change.uri);
      }
    });
  }

  @OnEvent(EditorDocumentModelCreationEvent)
  private async editorDocumentModelCreationHandler(e: EditorDocumentModelCreationEvent) {
    if (e.payload.uri.scheme !== 'file') {
      return;
    }

    const uri = e.payload.uri;
    const uriString = e.payload.uri.toString();
    /**
     * e.payload 里面有文件的完整文件 content 内容，内存占用较大
     * 如果 this.backService.requestInitContent/yMapReady.promise 一直不 resolve，会导致内存泄漏问题
     * 在获取完 e.payload.uri 后，将 e 置为 undefined 主动释放内存
     */
    (e as any) = undefined;

    const { bindingReady, yMapReady } = this.getDeferred(uriString);
    await this.backService.requestInitContent(uriString);
    await yMapReady.promise;
    // get monaco model from model ref by uri
    const ref = this.docModelManager.getModelReference(uri);
    const monacoModel = ref?.instance.getMonacoModel();
    ref?.dispose();
    if (monacoModel) {
      this.createAndSetBinding(uriString, monacoModel);
    }
    bindingReady.resolve();
  }

  @OnEvent(EditorDocumentModelRemovalEvent)
  private async editorDocumentModelRemovalHandler(e: EditorDocumentModelRemovalEvent) {
    if (e.payload.codeUri.scheme !== 'file') {
      return;
    }

    const uriString = e.payload.codeUri.toString();
    const { bindingReady } = this.getDeferred(uriString);
    await bindingReady.promise;
    this.removeBinding(uriString);
    this.resetDeferredBinding(uriString);
  }

  @OnEvent(EditorGroupOpenEvent)
  private async groupOpenHandler(e: EditorGroupOpenEvent) {
    const uriString = e.payload.resource.uri.toString();
    const { bindingReady } = this.getDeferred(uriString);
    await bindingReady.promise;
    const binding = this.getBinding(uriString);
    if (binding) {
      binding.addEditor(e.payload.group.codeEditor.monacoEditor);
    }
    // create content widget registry
    // check if editor has its widgetRegistry
    const monacoEditor = e.payload.group.codeEditor.monacoEditor;
    if (!this.cursorRegistryMap.has(monacoEditor) && monacoEditor) {
      const registry = this.injector.get(CursorWidgetRegistry, [monacoEditor, this.yWebSocketProvider.awareness]);
      this.cursorRegistryMap.set(monacoEditor, registry);
      monacoEditor.onDidDispose(() => {
        this.cursorRegistryMap.delete(monacoEditor);
        registry.destroy();
      });
    }
  }

  @OnEvent(EditorGroupCloseEvent)
  private async groupCloseHandler(e: EditorGroupCloseEvent) {
    const uriString = e.payload.resource.uri.toString();
    const { bindingReady } = this.getDeferred(uriString);
    await bindingReady.promise;
    const binding = this.getBinding(uriString);
    if (binding) {
      binding.removeEditor(e.payload.group.codeEditor.monacoEditor);
    }
  }
}
