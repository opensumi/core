/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { ILogger, OnEvent, URI, WithEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import {
  EditorActiveResourceStateChangedEvent,
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';
import { ITextModel, ICodeEditor } from '@opensumi/ide-monaco';

import { ICollaborationService } from '../common';

import { TextModelBinding } from './textmodel-binding';

import './styles.less';

@Injectable()
export class CollaborationService extends WithEventBus implements ICollaborationService {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  private yDoc: Y.Doc;

  private yWebSocketProvider: WebsocketProvider;

  private yTextMap: Y.Map<Y.Text>;

  private bindingMap: Map<string, TextModelBinding> = new Map();

  initialize() {
    this.yDoc = new Y.Doc();
    this.yTextMap = this.yDoc.getMap();
    this.yWebSocketProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'y-room-opensumi', this.yDoc);
    this.logger.log('Collaboration initialized');
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

  createBindingFromUri(uri: string, text: string, model: ITextModel): TextModelBinding {
    const cond = this.bindingMap.has(uri);

    if (!cond) {
      // add yText
      if (!this.yTextMap.has(uri)) {
        this.yTextMap.set(uri, new Y.Text(text));
      }
      const binding = new TextModelBinding(this.yTextMap.get(uri)!, model, this.yWebSocketProvider.awareness);
      this.bindingMap.set(uri, binding);
      return binding;
    } else {
      return this.bindingMap.get(uri)!;
    }
  }

  getBindingFromUri(uri: string) {
    const cond = this.bindingMap.has(uri);
    if (cond) {
      return this.bindingMap.get(uri)!;
    } else {
      return null;
    }
  }

  removeBindingFromUri(uri: string) {
    const binding = this.bindingMap.get(uri);
    if (binding) {
      binding.dispose();
      this.bindingMap.delete(uri);
      this.logger.log('Removed binding');
    }
  }

  // TextModel loaded before this event
  @OnEvent(EditorGroupOpenEvent)
  private groupOpenHandler(e: EditorGroupOpenEvent) {
    this.logger.log('Group open tabs', e);
  }

  @OnEvent(EditorGroupCloseEvent)
  private groupCloseHandler(e: EditorGroupCloseEvent) {
    this.logger.log('Group close tabs', e);
    const uri = e.payload.resource.uri.toString();
    // scan all opened uri
    const anyGroupHasThisUri = this.workbenchEditorService.getAllOpenedUris().find((u) => u === e.payload.resource.uri);
    if (!anyGroupHasThisUri) {
      // remove binding from uri
      this.removeBindingFromUri(uri);
    }
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  private editorActiveResourceStateChangedHandler(e: EditorActiveResourceStateChangedEvent) {
    // todo add to map, create binding
    // todo switch current current binding(maybe)
    // todo add editor from binding

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

    let binding: TextModelBinding | null;
    binding = this.getBindingFromUri(uri);
    if (!binding) {
      binding = this.createBindingFromUri(uri, text, textModel);
    }
    const monacoEditor = this.workbenchEditorService.currentCodeEditor?.monacoEditor;
    if (monacoEditor) {
      binding.addEditor(monacoEditor);
    }
  }
}
