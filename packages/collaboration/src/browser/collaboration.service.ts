/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { Injectable, Autowired, Inject, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Deferred, ILogger, OnEvent, uuid, WithEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorDocumentModelCreationEvent,
  EditorDocumentModelRemovalEvent,
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
  IEditorDocumentModelService,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ITextModel, ICodeEditor } from '@opensumi/ide-monaco';
import { ICSSStyleService } from '@opensumi/ide-theme';

import {
  CollaborationServiceForClientPath,
  ICollaborationService,
  ICollaborationServiceForClient,
  ROOM_NAME,
  UserInfo,
  CollaborationModuleContribution,
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

  private clientIDStyleAddedSet: Set<number> = new Set();

  private cursorRegistryMap: Map<ICodeEditor, CursorWidgetRegistry> = new Map();

  private userInfo: UserInfo;

  private yDoc: Y.Doc;

  private yWebSocketProvider: WebsocketProvider;

  private yTextMap: Y.Map<Y.Text>;

  private bindingMap: Map<string, TextModelBinding> = new Map();

  private yMapReadyMap: Map<string, Deferred<void>> = new Map();

  private bindingReadyMap: Map<string, Deferred<void>> = new Map();

  private yMapObserver = (event: Y.YMapEvent<Y.Text>) => {
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
    this.yDoc = new Y.Doc();
    this.yTextMap = this.yDoc.getMap();
    this.yWebSocketProvider = new WebsocketProvider('ws://127.0.0.1:12345', ROOM_NAME, this.yDoc); // TODO configurable uri and room name
    this.yTextMap.observe(this.yMapObserver);

    if (this.userInfo === undefined) {
      // fallback
      this.userInfo = {
        id: uuid().slice(0, 4),
        nickname: `${uuid().slice(0, 4)}`,
      };
    }
    // add userInfo to awareness field
    this.yWebSocketProvider.awareness.setLocalStateField('user-info', this.userInfo);

    this.yWebSocketProvider.awareness.on('update', this.updateCSSManagerWhenAwarenessUpdated);
  }

  destroy() {
    this.yWebSocketProvider.awareness.off('update', this.updateCSSManagerWhenAwarenessUpdated);
    this.clientIDStyleAddedSet.forEach((clientID) => {
      this.cssManager.removeClass(`${Y_REMOTE_SELECTION}-${clientID}`);
      this.cssManager.removeClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}`);
      this.cssManager.removeClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}::after`);
    });
    this.yTextMap.unobserve(this.yMapObserver);
    this.yWebSocketProvider.disconnect();
    this.bindingMap.forEach((binding) => binding.dispose());
  }

  getUseInfo(): UserInfo {
    if (!this.userInfo) {
      throw new Error('User info is not registered');
    }

    return this.userInfo;
  }

  setUserInfo(contribution: CollaborationModuleContribution) {
    if (this.userInfo) {
      throw new Error('User info is already registered');
    }

    if (contribution.info) {
      this.userInfo = contribution.info;
    }
  }

  undoOnCurrentResource() {
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    if (uri && this.bindingMap.has(uri)) {
      this.bindingMap.get(uri)!.undo();
    }
  }

  redoOnCurrentResource() {
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
      binding.dispose();
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
          const color = getColorByClientID(clientID);
          this.cssManager.addClass(`${Y_REMOTE_SELECTION}-${clientID}`, {
            backgroundColor: color,
            opacity: '0.25',
          });
          this.cssManager.addClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}`, {
            position: 'absolute',
            borderLeft: `${color} solid 2px`,
            borderBottom: `${color} solid 2px`,
            borderTop: `${color} solid 2px`,
            height: '100%',
            boxSizing: 'border-box',
          });
          this.cssManager.addClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}::after`, {
            position: 'absolute',
            content: ' ',
            border: `3px solid ${color}`,
            left: '-4px',
            top: '-5px',
          });
          this.clientIDStyleAddedSet.add(clientID);
        }
      });
    }
  };

  @OnEvent(EditorDocumentModelCreationEvent)
  private async editorDocumentModelCreationHandler(e: EditorDocumentModelCreationEvent) {
    const uriString = e.payload.uri.toString();
    const { bindingReady, yMapReady } = this.getDeferred(uriString);
    await this.backService.requestInitContent(uriString);
    await yMapReady.promise;
    // get monaco model from model ref by uri
    const ref = this.docModelManager.getModelReference(e.payload.uri);
    const monacoModel = ref?.instance.getMonacoModel();
    ref?.dispose();
    if (monacoModel) {
      this.createAndSetBinding(uriString, monacoModel);
    }
    bindingReady.resolve();
  }

  @OnEvent(EditorDocumentModelRemovalEvent)
  private async editorDocumentModelRemovalHandler(e: EditorDocumentModelRemovalEvent) {
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
