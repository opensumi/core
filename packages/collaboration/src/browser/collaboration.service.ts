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

import { TextModelBinding } from './editor-binding';

import './styles.less';

@Injectable()
export class CollaborationService extends WithEventBus implements ICollaborationService {
  @Autowired(ILogger)
  private logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  private yDoc: Y.Doc;

  private yWebSocketProvider: WebsocketProvider;

  private textMap: Map<string, string | undefined> = new Map();

  private yTextMap: Y.Map<Y.Text>;

  private currentCodeEditor: ICodeEditor | null;

  private currentBinding: TextModelBinding;

  initialize() {
    this.yDoc = new Y.Doc();
    this.yTextMap = this.yDoc.getMap('text-map');
    this.yWebSocketProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'monaco-opensumi', this.yDoc);
    this.logger.log('Collaboration initialized');
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
    // currently support single editor binding
    // current group changed <=> current editor changed
    if (this.currentCodeEditor !== this.workbenchEditorService.currentCodeEditor) {
      this.currentCodeEditor = this.workbenchEditorService.currentCodeEditor;
    }

    // get current uri
    const uri = this.workbenchEditorService.currentResource?.uri.toString();
    this.logger.log('Opened uri', uri);
    const text = this.currentCodeEditor?.currentDocumentModel?.getText();

    if (!uri || text === undefined) {
      return;
    }

    // only when a resourced is active, create and binding Y.Text to its textModel
    if (!this.textMap.has(uri)) {
      this.textMap.set(uri, this.currentCodeEditor?.currentDocumentModel?.getText());
    }
    this.logger.log('text map', [...this.textMap.keys()]);

    if (!this.yTextMap.has(uri)) {
      this.yTextMap.set(uri, new Y.Text(text));
    }

    // this event was fired after text model
    const textModel = this.currentCodeEditor?.currentDocumentModel?.getMonacoModel();
    this.logger.log('textModel', textModel);

    if (textModel) {
      if (this.currentBinding) {
        // todo save to somewhere
        this.currentBinding.dispose();
      }
      // just bind it
      const monacoEditor = this.currentCodeEditor?.monacoEditor;
      if (monacoEditor) {
        this.currentBinding = new TextModelBinding(
          this.yTextMap.get(uri)!,
          textModel,
          monacoEditor,
          this.yWebSocketProvider.awareness,
        );
        this.logger.log('binding', this.currentBinding);
      }
    }
  }
}
