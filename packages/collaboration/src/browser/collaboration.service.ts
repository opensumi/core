/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { Injectable, Autowired, Inject, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { FilesChangeEvent } from '@opensumi/ide-core-browser';
import { FileChangeType, ILogger, OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { EditorActiveResourceStateChangedEvent, EditorGroupCloseEvent } from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ITextModel, ICodeEditor } from '@opensumi/ide-monaco';

import {
  CollaborationServiceForClientPath,
  ICollaborationService,
  ICollaborationServiceForClient,
  ROOM_NAME,
} from '../common';

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
    this.logger.debug('Collaboration initialized');
  }

  destroy() {
    this.yTextMap.unobserve(this.yMapObserver);
    this.yWebSocketProvider.disconnect();
    this.bindingMap.forEach((binding) => binding.dispose());
  }

  undoOnCurrentBinding() {
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    if (uri && this.bindingMap.has(uri)) {
      this.bindingMap.get(uri)!.undo();
    }
  }

  redoOnCurrentBinding() {
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
      // todo ref = ref - 1 (through back service)
      this.logger.debug('Removed binding');
    }
  }

  @OnEvent(FilesChangeEvent)
  private fileChangeEventHandler(e: FilesChangeEvent) {
    e.payload.forEach((e) => {
      if (e.type === FileChangeType.DELETED) {
        this.logger.debug('DELETED', e.uri);
        this.backService.removeYText(e.uri);
      }
    });
  }

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
        this.backService.setInitContent(uri, text);
        // binding will be eventually created on yMap event
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
