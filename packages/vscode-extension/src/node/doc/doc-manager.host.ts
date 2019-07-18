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
import { Uri } from '../../common/ext-types';

export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private readonly rpcProtocol: IRPCProtocol;
  private readonly _proxy: IMainThreadDocumentsShape;
  private readonly _logService: any;

  private _documents: Map<string, ExtHostDocumentData> = new Map();

  private _onDocumentModelChanged = new EventEmiiter<ExtensionDocumentModelChangedEvent>();
  private _onDocumentModelOpened = new EventEmiiter<ExtensionDocumentModelOpenedEvent>();
  private _onDocumentModelRemoved = new EventEmiiter<ExtensionDocumentModelRemovedEvent>();
  private _onDocumentModelSaved = new EventEmiiter<ExtensionDocumentModelSavedEvent>();

  public onDocumentModelChanged = this._onDocumentModelChanged.event;
  public onDocumentModelOpened = this._onDocumentModelOpened.event;
  public onDocumentModelRemoved = this._onDocumentModelRemoved.event;
  public onDocumentModelSaved = this._onDocumentModelSaved.event;

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

  getDocumentData(path: Uri | string) {
    const uri = path.toString();
    return this._documents.get(uri);
  }

  getDocument(uri: Uri | string) {
    const data = this.getDocumentData(uri);
    return data ? data.document : undefined;
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

      console.log(document.getText());

    }

    this._onDocumentModelChanged.fire(e);
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
    this._onDocumentModelOpened.fire(e);
  }

  $fireModelRemovedEvent(e: ExtensionDocumentModelRemovedEvent) {
    const { uri } = e;
    this._documents.delete(uri);

    this._onDocumentModelRemoved.fire(e);
  }

  $fireModelSavedEvent(e: ExtensionDocumentModelSavedEvent) {
    const { uri } = e;
    const document = this._documents.get(uri);
    if (document) {
      document._acceptIsDirty(false);
    }

    this._onDocumentModelSaved.fire(e);
  }
}
