/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { Injectable, Autowired } from '@opensumi/di';
import { ILogger, OnEvent, WithEventBus } from '@opensumi/ide-core-common';
import { WorkbenchEditorService, ICodeEditor } from '@opensumi/ide-editor';
import {
  EditorActiveResourceStateChangedEvent,
  EditorGroupCloseEvent,
  EditorGroupOpenEvent,
} from '@opensumi/ide-editor/lib/browser';
import { WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

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

  private currentActiveBinding: TextModelBinding;

  private bindingMap: Map<string, TextModelBinding> = new Map();

  initialize() {
    this.yDoc = new Y.Doc();
    this.yTextMap = this.yDoc.getMap('text-map');
    this.yWebSocketProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'monaco-opensumi', this.yDoc);
    this.logger.log('Collaboration initialized');
  }

  undoOnCurrentBinding() {
    if (this.currentActiveBinding) {
      this.currentActiveBinding.undo();
    }
  }

  redoOnCurrentBinding() {
    if (this.currentActiveBinding) {
      this.currentActiveBinding.redo();
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
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  private editorActiveResourceStateChangedHandler(e: EditorActiveResourceStateChangedEvent) {
    // only support code editor
    if (e.payload.openType === null || e.payload.openType?.type !== 'code') {
      return;
    }

    // get current uri
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    this.logger.log('Opened uri', uri);
    const text = this.workbenchEditorService.currentCodeEditor?.currentDocumentModel?.getText();

    if (!uri || text === undefined) {
      return;
    }

    if (!this.yTextMap.has(uri)) {
      this.yTextMap.set(uri, new Y.Text(text));
    }

    // this event was fired after text model
    const textModel = this.workbenchEditorService.currentCodeEditor?.currentDocumentModel?.getMonacoModel();
    this.logger.log('textModel', textModel);

    const currentUri = uri;

    const monacoEditor = this.workbenchEditorService.currentCodeEditor?.monacoEditor;
    if (textModel && monacoEditor) {
      // remove all editor, brute-force, will be optimized soon
      this.bindingMap.forEach((binding) => {
        binding.removeEditor(monacoEditor);
        binding.offEventListener();
      });

      // just bind it
      if (this.bindingMap.has(currentUri)) {
        this.currentActiveBinding = this.bindingMap.get(currentUri)!;
        this.currentActiveBinding.addEditor(monacoEditor); // debug
        this.currentActiveBinding.onEventListener();
      } else {
        this.currentActiveBinding = new TextModelBinding(
          this.yTextMap.get(uri)!,
          textModel,
          monacoEditor,
          this.yWebSocketProvider.awareness,
        );
        this.currentActiveBinding.addEditor(monacoEditor); // debug
        this.bindingMap.set(currentUri, this.currentActiveBinding);
        this.logger.log('binding', this.currentActiveBinding);
      }
    }
  }
}
