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

  private yText: Y.Text;

  private yWebSocketProvider: WebsocketProvider;

  private textMap: Map<string, string | undefined> = new Map();

  private yTextMap: Y.Map<Y.Text>;

  private counterMap: Map<string, number> = new Map();

  private openedTab: Set<string> = new Set();

  private currentCodeEditor: ICodeEditor | null;

  private currentBinding: TextModelBinding;

  initialize() {
    this.yDoc = new Y.Doc();
    this.yText = this.yDoc.getText('114514');
    this.yTextMap = this.yDoc.getMap('text-map');
    this.yWebSocketProvider = new WebsocketProvider('ws://127.0.0.1:12345', 'monaco-opensumi', this.yDoc);
    this.logger.log('Collaboration initialized');
  }

  // TextModel loaded before this event
  @OnEvent(EditorGroupOpenEvent)
  private groupOpenHandler(e: EditorGroupOpenEvent) {
    this.logger.log('Group open tabs', e);
    this.workbenchEditorService.getAllOpenedUris().forEach((u) => {
      const uri = u.toString();
      if (!this.openedTab.has(uri)) {
        this.openedTab.add(uri);
        if (!this.counterMap.has(uri)) {
          this.counterMap.set(uri, 1);
        } else {
          this.counterMap.set(uri, this.counterMap.get(uri)! + 1);
        }
      }
    });
    this.logger.log('Counter map', this.counterMap);
  }

  @OnEvent(EditorGroupCloseEvent)
  private groupCloseHandler(e: EditorGroupCloseEvent) {
    this.logger.log('Group close tabs', e);
    const uri = e.payload.resource.uri.toString();
    if (
      this.counterMap.has(uri) &&
      !this.workbenchEditorService
        .getAllOpenedUris()
        .map((u) => u.toString())
        .includes(uri)
    ) {
      this.counterMap.set(uri, this.counterMap.get(uri)! - 1);
      if (this.counterMap.get(uri)! <= 0) {
        this.counterMap.delete(uri);
        this.openedTab.delete(uri);
        this.textMap.delete(uri);
      }
    }
    this.logger.log('Counter map', this.counterMap);
  }

  @OnEvent(EditorActiveResourceStateChangedEvent)
  private editorActiveResourceStateChangedHandler(e: EditorActiveResourceStateChangedEvent) {
    // currently support single editor binding
    // current group changed <=> current editor changed
    if (this.currentCodeEditor !== this.workbenchEditorService.currentCodeEditor) {
      this.currentCodeEditor = this.workbenchEditorService.currentCodeEditor;
    }
    this.logger.log(e);

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
      this.yTextMap.set(uri, new Y.Text(this.currentCodeEditor?.currentDocumentModel?.getText()!));
    }

    // update counter according to currently opened uris
    const uris = this.workbenchEditorService.getAllOpenedUris();
    this.logger.log('Opened uris', uris);

    // this event was fired after text model
    // this.logger.log('text model content', this.currentCodeEditor?.currentDocumentModel?.getText());
    const textModel = this.currentCodeEditor?.currentDocumentModel?.getMonacoModel();
    this.logger.log('textModel', textModel);

    if (textModel) {
      if (this.currentBinding) {
        // todo save to somewhere
        this.currentBinding.dispose();
      }
      // just bind it
      const monacoEditor = this.currentCodeEditor?.monacoEditor;
      this.currentBinding = new TextModelBinding(
        this.yTextMap.get(uri)!,
        textModel,
        monacoEditor!,
        this.yWebSocketProvider.awareness,
      );
      this.logger.log('binding', this.currentBinding);
    }
  }
}
