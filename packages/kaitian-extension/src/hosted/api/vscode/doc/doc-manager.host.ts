import * as vscode from 'vscode';
import * as convert from '../../../../common/vscode/converter';
import {
  Emitter as EventEmiiter, IDisposable,
  CancellationToken,
  CancellationTokenSource,
} from '@ali/ide-core-common';
import {
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
} from '@ali/ide-doc-model/lib/common';
import { ExtensionDocumentDataManager, IMainThreadDocumentsShape, MainThreadAPIIdentifier } from '../../../../common/vscode';
import { ExtHostDocumentData, setWordDefinitionFor } from './ext-data.host';
import { IRPCProtocol } from '@ali/ide-connection';
import { Uri } from '../../../../common/vscode/ext-types';

const OPEN_TEXT_DOCUMENT_TIMEOUT = 5000;

export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _proxy: IMainThreadDocumentsShape;
  private readonly _logService: any;

  private _documents: Map<string, ExtHostDocumentData> = new Map();
  private _contentProviders: Map<string, vscode.TextDocumentContentProvider> = new Map();

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
  getDocumentData(path: Uri | string) {
    const uri = path.toString();
    return this._documents.get(uri);
  }

  getAllDocument() {
    return this.allDocumentData.map((data) => {
      return data.document;
    });
  }

  getDocument(uri: Uri | string) {
    const data = this.getDocumentData(uri);
    return data ? data.document : undefined;
  }

  async openTextDocument(path: Uri | string) {
    let uri: Uri;

    if (typeof path === 'string') {
      uri = Uri.file(path);
    } else {
      uri = Uri.parse(path.toString());
    }

    const doc = this._documents.get(uri.toString());
    if (doc) {
      return doc.document;
    } else {
      await this._proxy.$tryOpenDocument(uri.toString());
      const doc = this._documents.get(uri.toString());
      if (doc) {
        return doc.document;
      } else {
        return new Promise<vscode.TextDocument> ((resolve, reject) => {
          let resolved = false;
          setTimeout(() => {
            if (!resolved) {
              reject('Open Text Document ' + uri.toString() + ' Timeout. Current Timeout is 5 seconds.');
            }
          }, OPEN_TEXT_DOCUMENT_TIMEOUT);
          const disposer = this.onDidOpenTextDocument((document) => {
            if (uri.toString() === document.uri.toString()) {
              resolve(document);
              disposer.dispose();
              resolved = true;
            }
          });
        });

      }
    }
  }

  registerTextDocumentContentProvider(scheme: string, provider: vscode.TextDocumentContentProvider): IDisposable {
    let changeDispose: IDisposable;

    const onDidChangeEvent = provider.onDidChange;
    this._contentProviders.set(scheme, provider);

    if (onDidChangeEvent) {
      changeDispose = onDidChangeEvent(async (uri) => {
        const source = new CancellationTokenSource();
        const content = await provider.provideTextDocumentContent(uri, source.token);
        if (content) {
          this._proxy.$fireTextDocumentChangedEvent(uri.toString(), content);
        }
      });
    }

    this._proxy.$registerDocumentProviderWithScheme(scheme);

    return {
      dispose: () => {
        this._proxy.$unregisterDocumentProviderWithScheme(scheme);
        this._contentProviders.delete(scheme);
        if (changeDispose) {
          changeDispose.dispose();
        }
      },
    };
  }

  async $provideTextDocumentContent(path: string, token: CancellationToken) {
    const uri = Uri.parse(path);
    const scheme = uri.scheme;
    const provider = this._contentProviders.get(scheme);

    if (provider) {
      const content = await provider.provideTextDocumentContent(uri, token);
      return content;
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
            range: convert.toRange(change.range) as any,
          };
        }),
      });
    } else {
      // TODO: 增加消息后台未接受到的情况
    }
  }

  $fireModelOpenedEvent(e: ExtensionDocumentModelOpenedEvent) {
    const { uri, eol, languageId, versionId, lines, dirty } = e;
    const document = new ExtHostDocumentData(
      this._proxy,
      Uri.parse(uri),
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

  setWordDefinitionFor(modeId: string, wordDefinition: RegExp | undefined) {
    setWordDefinitionFor(modeId, wordDefinition);
  }
}
