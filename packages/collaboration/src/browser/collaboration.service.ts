/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { Injectable, Autowired, Inject, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { ILogger, OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorActiveResourceStateChangedEvent, EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ITextModel, ICodeEditor } from '@opensumi/ide-monaco';
import { ICSSStyleService } from '@opensumi/ide-theme';

import {
  CollaborationServiceForClientPath,
  ICollaborationService,
  ICollaborationServiceForClient,
  ROOM_NAME,
  UserInfo,
  UserInfoForCollaborationContribution,
  Y_REMOTE_SELECTION,
  Y_REMOTE_SELECTION_HEAD,
} from '../common';

import { getColorByClientID } from './color';
import { CursorWidgetRegistry } from './cursor-widget';
import { TextModelBinding } from './textmodel-binding';

import './styles.less';

class PendingBindingPayload {
  model: ITextModel;
  editor: ICodeEditor | undefined;
}

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

  private clientIDStyleAddedSet: Set<number> = new Set();

  // hold editor => registry
  private cursorRegistryMap: Map<ICodeEditor, CursorWidgetRegistry> = new Map();

  private userInfo: UserInfo;

  private yDoc: Y.Doc;

  private yWebSocketProvider: WebsocketProvider;

  private yTextMap: Y.Map<Y.Text>;

  private bindingMap: Map<string, TextModelBinding> = new Map();

  private pendingBinding: Map<string, PendingBindingPayload> = new Map();

  private yMapObserver = (event: Y.YMapEvent<Y.Text>) => {
    const changes = event.changes.keys;
    this.logger.debug('Change occurs', changes);
    changes.forEach((change, key) => {
      if (change.action === 'add') {
        if (this.pendingBinding.has(key) && !this.bindingMap.has(key)) {
          // retrieve from payload object, then create new binding
          const payload = this.pendingBinding.get(key)!;
          const binding = this.createAndSetBinding(key, payload.model);
          if (payload.editor) {
            binding.addEditor(payload.editor);
          }
          this.pendingBinding.delete(key);
          this.logger.debug('Binding created', binding);
        }
      } else if (change.action === 'delete') {
        this.removeBinding(key);
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

    // add userInfo to awareness field
    this.yWebSocketProvider.awareness.setLocalStateField('user-info', this.userInfo);

    this.logger.debug('Collaboration initialized');

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

  setUserInfo(contribution: UserInfoForCollaborationContribution) {
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

  private createAndSetBinding(uri: string, model: ITextModel): TextModelBinding {
    const cond = this.bindingMap.has(uri);

    if (!cond) {
      const binding = this.injector.get(TextModelBinding, [
        this.yTextMap.get(uri)!, // only be called after yMap event
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
      this.logger.debug('Removed binding');
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
    if (changes.removed.length > 0) {
      changes.removed.forEach((clientID) => {
        this.cssManager.removeClass(`${Y_REMOTE_SELECTION}-${clientID}`);
        this.cssManager.removeClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}`);
        this.cssManager.removeClass(`${Y_REMOTE_SELECTION_HEAD}-${clientID}::after`);
        this.clientIDStyleAddedSet.delete(clientID);
      });
    }
    if (changes.added.length > 0 || changes.updated.length > 0) {
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

  @OnEvent(EditorGroupCloseEvent)
  private groupCloseHandler(e: EditorGroupCloseEvent) {
    this.logger.debug('Group close tabs', e);
    const uri = e.payload.resource.uri.toString();
    // scan all opened uri
    const anyGroupHasThisUri = this.workbenchEditorService.getAllOpenedUris().find((u) => u === e.payload.resource.uri);
    if (!anyGroupHasThisUri) {
      // remove binding from uri
      this.removeBinding(uri);
    }
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  private editorActiveResourceStateChangedHandler(e: EditorActiveResourceStateChangedEvent) {
    // only support code editor
    if (e.payload.openType === null || e.payload.openType?.type !== 'code') {
      return;
    }

    // get current uri
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    const text = this.workbenchEditorService.currentCodeEditor?.currentDocumentModel?.getText();
    const textModel = this.workbenchEditorService.currentCodeEditor?.currentDocumentModel?.getMonacoModel();

    if (!uri || text === undefined || textModel === undefined) {
      return;
    }

    const monacoEditor = this.workbenchEditorService.currentCodeEditor?.monacoEditor;
    const binding = this.getBinding(uri);

    // check if editor has its widgetRegistry
    if (monacoEditor && !this.cursorRegistryMap.has(monacoEditor)) {
      const registry = this.injector.get(CursorWidgetRegistry, [monacoEditor, this.yWebSocketProvider.awareness]);
      this.cursorRegistryMap.set(monacoEditor, registry);
      monacoEditor.onDidDispose(() => {
        registry.destroy();
      });
    }

    // check if there exists any binding
    if (!binding) {
      if (this.yTextMap.has(uri)) {
        const binding = this.createAndSetBinding(uri, textModel);
        if (monacoEditor) {
          // add current editor after binding creation
          binding.addEditor(monacoEditor);
        }
        this.logger.debug('Binding created', binding);
      } else {
        // tell server to set init content
        this.backService.requestInitContent(uri);
        // binding will be eventually created on yMap event

        // FIXME if file not found?
        this.pendingBinding.set(uri, { model: textModel, editor: monacoEditor });
      }
    } else {
      if (monacoEditor) {
        // if binding, directly add current editor
        binding.addEditor(monacoEditor);
      }
    }
  }
}
