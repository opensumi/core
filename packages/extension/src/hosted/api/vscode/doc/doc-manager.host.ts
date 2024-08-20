import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  BinaryBuffer,
  CancellationTokenSource,
  Emitter,
  IDisposable,
  URI,
  isDefined,
  isUTF8,
  normalizeFileUrl,
} from '@opensumi/ide-core-common';

import {
  ExtensionDocumentDataManager,
  IExtensionDocumentModelChangedEvent,
  IExtensionDocumentModelOpenedEvent,
  IExtensionDocumentModelOptionsChangedEvent,
  IExtensionDocumentModelRemovedEvent,
  IExtensionDocumentModelSavedEvent,
  IExtensionDocumentModelWillSaveEvent,
  IMainThreadDocumentsShape,
  IMainThreadWorkspace,
  MainThreadAPIIdentifier,
} from '../../../../common/vscode';
import { TextEdit as TextEditConverter, toRange } from '../../../../common/vscode/converter';
import { TextDocumentChangeReason, TextEdit, Uri } from '../../../../common/vscode/ext-types';

import { ExtHostDocumentData, setWordDefinitionFor } from './ext-data.host';

import type * as model from '../../../../common/vscode/model.api';
import type vscode from 'vscode';

const OPEN_TEXT_DOCUMENT_TIMEOUT = 5000;

export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _proxy: IMainThreadDocumentsShape;
  private readonly _workspaceProxy: IMainThreadWorkspace;

  private _documents: Map<string, ExtHostDocumentData> = new Map();
  private _contentProviders: Map<string, vscode.TextDocumentContentProvider> = new Map();

  private _onDidOpenTextDocument = new Emitter<vscode.TextDocument>();
  private _onDidCloseTextDocument = new Emitter<vscode.TextDocument>();
  private _onDidChangeTextDocument = new Emitter<vscode.TextDocumentChangeEvent>();
  private _onWillSaveTextDocument = new Emitter<vscode.TextDocumentWillSaveEvent>();
  private _onDidSaveTextDocument = new Emitter<vscode.TextDocument>();

  public onDidOpenTextDocument = this._onDidOpenTextDocument.event;
  public onDidCloseTextDocument = this._onDidCloseTextDocument.event;
  public onDidChangeTextDocument = this._onDidChangeTextDocument.event;
  public onWillSaveTextDocument = this._onWillSaveTextDocument.event;
  public onDidSaveTextDocument = this._onDidSaveTextDocument.event;

  constructor(rpcProtocol: IRPCProtocol) {
    this.rpcProtocol = rpcProtocol;
    this._proxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadDocuments);
    this._workspaceProxy = this.rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWorkspace);
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
    return this.allDocumentData.map((data) => data.document);
  }

  getDocument(uri: Uri | string) {
    const data = this.getDocumentData(uri);
    if (!data?.document) {
      throw new Error(`Unable to retrieve document from URI '${uri}'`);
    }
    return data.document;
  }

  async openTextDocument(uriOrFileNameOrOptions?: Uri | string | { language?: string; content?: string }) {
    let uri: Uri;
    const options = uriOrFileNameOrOptions as { language?: string; content?: string };

    if (typeof uriOrFileNameOrOptions === 'string') {
      uri = Uri.file(uriOrFileNameOrOptions);
    } else if (URI.isUri(uriOrFileNameOrOptions)) {
      uri = Uri.parse(uriOrFileNameOrOptions.toString());
    } else if (!options || typeof options === 'object') {
      uri = Uri.parse(await this._proxy.$tryCreateDocument(options));
    } else {
      throw new Error('illegal argument - uriOrFileNameOrOptions');
    }

    const docUrl = normalizeFileUrl(uri.toString());
    const doc = this._documents.get(docUrl);
    if (doc) {
      return doc.document;
    } else {
      await this._proxy.$tryOpenDocument(docUrl);
      const doc = this._documents.get(docUrl);
      if (doc) {
        return doc.document;
      } else {
        return new Promise<vscode.TextDocument>((resolve, reject) => {
          let resolved = false;
          setTimeout(() => {
            if (!resolved) {
              reject(
                `Open Text Document ${docUrl} Timeout. Current Timeout is ${
                  OPEN_TEXT_DOCUMENT_TIMEOUT / 1000
                } seconds.`,
              );
            }
          }, OPEN_TEXT_DOCUMENT_TIMEOUT);
          const disposer = this.onDidOpenTextDocument((document) => {
            if (docUrl === document.uri.toString()) {
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

  async $provideTextDocumentContent(path: string, encoding?: string) {
    const uri = Uri.parse(path);
    const scheme = uri.scheme;
    const provider = this._contentProviders.get(scheme);

    if (provider) {
      // cancellation token 暂时还没接入，以后可能优化
      let content = (await provider.provideTextDocumentContent(uri, new CancellationTokenSource().token)) || '';
      if (content && encoding && !isUTF8(encoding)) {
        // 默认 encoding 为 UTF8，所以仅在非 UTF8 的情况下做转换
        const buffer = BinaryBuffer.wrap(Buffer.from(content));
        content = buffer.toString(encoding);
      }

      return content;
    }

    throw new Error('new document provider for ' + path);
  }

  $fireModelOptionsChangedEvent(e: IExtensionDocumentModelOptionsChangedEvent) {
    const document = this._documents.get(e.uri);
    if (document) {
      // 和 vscode 表现保持一致，接收到 languages 变更时，发送一个 close 和一个 open 事件
      if (isDefined(e.languageId) && e.languageId !== document._getLanguageId()) {
        document._acceptLanguageId(e.languageId);
        this._onDidCloseTextDocument.fire(document.document);
        this._onDidOpenTextDocument.fire(document.document);
      }
      if (isDefined(e.dirty)) {
        document._acceptIsDirty(e.dirty);
      }
    }
  }

  $fireModelChangedEvent(e: IExtensionDocumentModelChangedEvent) {
    const { uri, changes, versionId, eol, dirty, isRedoing, isUndoing } = e;
    const document = this._documents.get(uri);
    if (!document) {
      return;
    }
    document.onEvents({
      eol,
      versionId,
      changes,
      isRedoing,
      isUndoing,
    });
    document._acceptIsDirty(dirty);

    let reason: vscode.TextDocumentChangeReason | undefined;

    if (isRedoing) {
      reason = TextDocumentChangeReason.Redo;
    } else if (isUndoing) {
      reason = TextDocumentChangeReason.Undo;
    }

    this._onDidChangeTextDocument.fire({
      document: document.document,
      contentChanges: changes.map((change) => ({
        ...change,
        range: toRange(change.range),
      })),
      reason,
    });
  }

  $fireModelOpenedEvent(e: IExtensionDocumentModelOpenedEvent) {
    const { uri, eol, languageId, versionId, lines, dirty } = e;
    const document = new ExtHostDocumentData(this._proxy, Uri.parse(uri), lines, eol, languageId, versionId, dirty);

    this._documents.set(uri, document);
    this._onDidOpenTextDocument.fire(document.document);
  }

  $fireModelRemovedEvent(e: IExtensionDocumentModelRemovedEvent) {
    const { uri } = e;
    const document = this._documents.get(uri.toString());

    if (document) {
      this._documents.delete(uri);
      this._onDidCloseTextDocument.fire(document.document);
    }
  }

  $fireModelSavedEvent(e: IExtensionDocumentModelSavedEvent) {
    const { uri } = e;
    const document = this._documents.get(uri);

    if (document) {
      document._acceptIsDirty(false);
      this._onDidSaveTextDocument.fire(document.document);
    }
  }

  async $fireModelWillSaveEvent(e: IExtensionDocumentModelWillSaveEvent) {
    const { uri } = e;
    const document = this._documents.get(uri);

    if (document) {
      document._acceptIsDirty(e.dirty);

      const promises: Promise<any>[] = [];
      const event: vscode.TextDocumentWillSaveEvent = {
        document: document.document,
        reason: e.reason as number,
        waitUntil: (promise) => {
          promises.push(this.createWaitUntil(document.document.uri, promise));
        },
      };
      this._onWillSaveTextDocument.fire(event);
      await Promise.all(promises);
      return;
    }
    throw new Error('document not found: ' + uri.toString());
  }

  async createWaitUntil(uri: Uri, promise: Promise<TextEdit[] | void>): Promise<void> {
    const res = await promise;
    if (res instanceof Array && res[0] && res[0] instanceof TextEdit) {
      await this.applyEdit(uri, res.map(TextEditConverter.from)[0]);
    }
  }

  setWordDefinitionFor(modeId: string, wordDefinition: RegExp | undefined) {
    setWordDefinitionFor(modeId, wordDefinition);
  }

  applyEdit(uri: Uri, edit: model.TextEdit): Promise<boolean> {
    const dto: model.WorkspaceEditDto = {
      edits: [
        {
          resource: uri,
          textEdit: edit,
          versionId: undefined,
        },
      ],
    };
    return this._workspaceProxy.$tryApplyWorkspaceEdit(dto);
  }
}
