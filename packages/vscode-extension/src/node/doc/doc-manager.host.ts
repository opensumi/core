import { Injectable } from '@ali/common-di';
import { Emitter as EventEmiiter } from '@ali/ide-core-common';
import {
  ExtentionDocumentModelChangedEvent,
} from '@ali/ide-doc-model';
import { ExtensionDocumentDataManager } from '../../common';
import { ExtHostDocumentData } from './ext-data.host';

@Injectable()
export class ExtensionDocumentDataManagerImpl implements ExtensionDocumentDataManager {
  private _documents: Map<string, ExtHostDocumentData>;

  private _onDocumentModelChanged = new EventEmiiter<ExtentionDocumentModelChangedEvent>();
  private _onDocumentModelOpened = new EventEmiiter<void>();
  private _onDocumentModelRemoved = new EventEmiiter<void>();

  public onDocumentModelChanged = this._onDocumentModelChanged.event;
  public onDocumentModelOpened = this._onDocumentModelOpened.event;
  public onDocumentModelRemoved = this._onDocumentModelRemoved.event;

  constructor() {
    this.onDocumentModelChanged((event) => {
      const { uri, changes, versionId, eol, dirty } = event;
      const document = this._documents.get(uri);
      if (document) {
        document.onEvents({
          eol,
          versionId,
          changes,
        });
        document._acceptIsDirty(dirty);
      }
    });
  }

  fireModelChangedEvent(e: ExtentionDocumentModelChangedEvent) {
    this._onDocumentModelChanged.fire(e);
  }

  getDocumentData(resource) {
    return this._documents.get(resource);
  }
}
