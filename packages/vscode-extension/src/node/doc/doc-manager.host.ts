import * as vscode from 'vscode';
import * as convert from '../../common/converter';
import { Emitter as EventEmiiter, URI } from '@ali/ide-core-common';
import {
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
} from '@ali/ide-doc-model/lib/common';
import { ExtensionDocumentDataManager, IMainThreadDocumentsShape, MainThreadAPIIdentifier } from '../../common';
import { ExtHostDocumentData } from './ext-data.host';
import { IRPCProtocol } from '@ali/ide-connection';
import vscodeUri from 'vscode-uri';

export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _proxy: IMainThreadDocumentsShape;
  private readonly _logService: any;

  private _documents: Map<string, ExtHostDocumentData> = new Map();

  private _onDidOpenTextDocument = new EventEmiiter<vscode.TextDocument>();
  private _onDidCloseTextDocument = new EventEmiiter<vscode.TextDocument>();
  private _onDidChangeTextDocument = new EventEmiiter<vscode.TextDocumentChangeEvent>();
  private _onWillSaveTextDocument = new EventEmiiter<vscode.TextDocument>();
  private _onDidSaveTextDocument = new EventEmiiter<vscode.TextDocument>();

  public onDidOpenTextDocument = this._onDidOpenTextDocument.event;
  public onDidCloseTextDocument = this._onDidCloseTextDocument.event;
  public onDidChangeTextDocument = this._onDidChangeTextDocument.event;
  public onWillSaveTextDocument = this._onWillSaveTextDocument.event;
  public onDidSaveTextDocument = this._onDidSaveTextDocument.event;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDocuments);
    this._logService = {
      trace() {
        console.log.apply(console, arguments as any);
      },
    };
  }

  get allDocumentData() {
    return Array.from(this._documents.values());
  }

  // 这里直接转成string，省的在vscode-uri和内部uri之间转换
  getDocumentData(path: vscodeUri | string) {
    const uri = path.toString();
    return this._documents.get(uri);
  }
  getAllDocument() {
    return this.allDocumentData.map((data) => {
      return data.document;
    });
  }
  getDocument(uri: vscodeUri | string) {
    const data = this.getDocumentData(uri);
    return data ? data.document : undefined;
  }
  async openTextDocument(path: vscodeUri | string) {
    let uri: URI;

    if (typeof path === 'string') {
      uri = URI.file(path);
    } else {
      uri = new URI(path.toString());
    }

    const doc = this._documents.get(uri.toString());
    if (doc) {
      return doc.document;
    } else {
      this._proxy.$tryOpenDocument(uri.toString());
    }
  }

  $fireModelChangedEvent(e: ExtensionDocumentModelChangedEvent) {
    const { uri, changes, versionId, eol, dirty } = e;
    const document = this._documents.get(uri);
    if (document) {
      document.onEvents({
        eol,
        versionId,
        changes,
      });
      document._acceptIsDirty(dirty);
      this._onDidChangeTextDocument.fire({
        document: document.document,
        contentChanges: changes.map((change) => {
          return {
            ...change,
            range: convert.toRange(change.range),
          };
        }),
      });
    }
  }

  $fireModelOpenedEvent(e: ExtensionDocumentModelOpenedEvent) {
    const { uri, eol, languageId, versionId, lines, dirty } = e;

    const document = new ExtHostDocumentData(
      this._proxy,
      new URI(uri),
      lines,
      eol,
      languageId,
      versionId,
      dirty,
    );

    this._documents.set(uri, document);
    this._onDidOpenTextDocument.fire(document.document);
  }

  $fireModelRemovedEvent(e: ExtensionDocumentModelRemovedEvent) {
    const { uri } = e;
    const document = this._documents.get(uri.toString());

    if (document) {
      this._documents.delete(uri);
      this._onDidCloseTextDocument.fire(document.document);
    }
  }

  $fireModelSavedEvent(e: ExtensionDocumentModelSavedEvent) {
    const { uri } = e;
    const document = this._documents.get(uri);

    if (document) {
      document._acceptIsDirty(false);
      this._onDidSaveTextDocument.fire(document.document);
    }
  }
}
