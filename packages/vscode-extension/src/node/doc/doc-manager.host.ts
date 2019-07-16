import { Injectable, Autowired } from '@ali/common-di';
import { Emitter as EventEmiiter, URI } from '@ali/ide-core-common';
import {
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
} from '@ali/ide-doc-model';
import { ExtensionDocumentDataManager, MainThreadDocumentsShape } from '../../common';
import { ExtHostDocumentData } from './ext-data.host';

@Injectable()
export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private _documents: Map<string, ExtHostDocumentData>;

  private _onDocumentModelChanged = new EventEmiiter<ExtensionDocumentModelChangedEvent>();
  private _onDocumentModelOpened = new EventEmiiter<ExtensionDocumentModelOpenedEvent>();
  private _onDocumentModelRemoved = new EventEmiiter<ExtensionDocumentModelRemovedEvent>();
  private _onDocumentModelSaved = new EventEmiiter<ExtensionDocumentModelSavedEvent>();

  public onDocumentModelChanged = this._onDocumentModelChanged.event;
  public onDocumentModelOpened = this._onDocumentModelOpened.event;
  public onDocumentModelRemoved = this._onDocumentModelRemoved.event;
  public onDocumentModelSaved = this._onDocumentModelSaved.event;

  @Autowired()
  readonly proxy: MainThreadDocumentsShape;

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
    }

    this._onDocumentModelChanged.fire(e);
  }

  $fireModelOpenedEvent(e: ExtensionDocumentModelOpenedEvent) {
    const { uri, eol, languageId, versionId, lines, dirty } = e;

    const document = new ExtHostDocumentData(
      this.proxy,
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
