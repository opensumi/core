import { IRPCProtocol } from '@opensumi/ide-connection';
import { Emitter, ResourceMap, Uri, UriComponents } from '@opensumi/ide-core-common';


import {
  ExtensionDocumentDataManager,
  IExtensionDocumentModelOpenedEvent,
  MainThreadAPIIdentifier,
} from '../../../common/vscode';
import {
  ExtensionNotebookDocumentManager,
  IMainThreadNotebookDocumentsShape,
  INotebookDocumentsAndEditorsDelta,
} from '../../../common/vscode/notebook';

import { ExtHostCell, ExtHostNotebookDocument } from './ext.host.notebookdocument';

import type { NotebookCellsChangedEventDto } from '@opensumi/ide-editor';
import type vscode from 'vscode';

export class ExtensionNotebookDocumentManagerImpl implements ExtensionNotebookDocumentManager {
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _proxy: IMainThreadNotebookDocumentsShape;

  private readonly _documents = new ResourceMap<ExtHostNotebookDocument>();

  private _onDidOpenNotebookDocument = new Emitter<vscode.NotebookDocument>();
  private _onDidCloseNotebookDocument = new Emitter<vscode.NotebookDocument>();
  private _onDidChangeNotebookDocument = new Emitter<vscode.NotebookDocumentChangeEvent>();
  private _onDidSaveNotebookDocument = new Emitter<vscode.NotebookDocument>();

  public onDidOpenNotebookDocument = this._onDidOpenNotebookDocument.event;
  public onDidCloseNotebookDocument = this._onDidCloseNotebookDocument.event;
  public onDidChangeNotebookDocument = this._onDidChangeNotebookDocument.event;
  public onDidSaveNotebookDocument = this._onDidSaveNotebookDocument.event;

  constructor(rpcProtocol: IRPCProtocol, private extHostDoc: ExtensionDocumentDataManager) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadNotebook);
  }

  get notebookDocuments() {
    return [...this._documents.values()].map((item) => item.apiNotebook);
  }

  getNotebookDocument(uri: Uri, relaxed: true): ExtHostNotebookDocument | undefined;
  getNotebookDocument(uri: Uri): ExtHostNotebookDocument;
  getNotebookDocument(uri: Uri, relaxed?: true): ExtHostNotebookDocument | undefined {
    const result = this._documents.get(uri);
    if (!result && !relaxed) {
      throw new Error(`NO notebook document for '${uri}'`);
    }
    return result;
  }

  $acceptDocumentAndEditorsDelta(delta: INotebookDocumentsAndEditorsDelta): void {
    if (delta.removedDocuments) {
      for (const uri of delta.removedDocuments) {
        const revivedUri = Uri.revive(uri);
        const document = this._documents.get(revivedUri);

        if (document) {
          document.dispose();
          this._documents.delete(revivedUri);
          // this.extHostDoc.$acceptDocumentsAndEditorsDelta({ removedDocuments: document.apiNotebook.getCells().map((cell) => cell.document.uri) });
          const removedDocuments = document.apiNotebook.getCells().map((cell) => cell.document.uri);
          removedDocuments.forEach((doc) => {
            this.extHostDoc.$fireModelRemovedEvent({ uri: doc.toString() });
          });
          this._onDidCloseNotebookDocument.fire(document.apiNotebook);
        }
      }
    }

    if (delta.addedDocuments) {
      const addedCellDocuments: IExtensionDocumentModelOpenedEvent[] = [];

      for (const modelData of delta.addedDocuments) {
        const uri = Uri.revive(modelData.uri);

        if (this._documents.has(uri)) {
          throw new Error(`adding EXISTING notebook ${uri} `);
        }

        const document = new ExtHostNotebookDocument(this._proxy, this.extHostDoc, uri, modelData);

        // add cell document as vscode.TextDocument
        addedCellDocuments.push(...modelData.cells.map((cell) => ExtHostCell.asModelAddData(cell)));

        this._documents.get(uri)?.dispose();
        this._documents.set(uri, document);
        // this._textDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({ addedDocuments: addedCellDocuments });
        addedCellDocuments.forEach((doc) => {
          this.extHostDoc.$fireModelOpenedEvent(doc);
        });

        this._onDidOpenNotebookDocument.fire(document.apiNotebook);
      }
    }
  }

  $acceptModelChanged(
    uri: UriComponents,
    event: NotebookCellsChangedEventDto,
    isDirty: boolean,
    newMetadata?: any,
  ): void {
    const document = this.getNotebookDocument(Uri.revive(uri));
    const e = document.acceptModelChanged(event, isDirty, newMetadata);
    this._onDidChangeNotebookDocument.fire(e);
  }

  $acceptDirtyStateChanged(uri: UriComponents, isDirty: boolean): void {
    const document = this.getNotebookDocument(Uri.revive(uri));
    document.acceptDirty(isDirty);
  }

  $acceptModelSaved(uri: UriComponents): void {
    const document = this.getNotebookDocument(Uri.revive(uri));
    this._onDidSaveNotebookDocument.fire(document.apiNotebook);
  }
}
