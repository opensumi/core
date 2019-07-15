import { Emitter as EventEmitter, WithEventBus, OnEvent } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import {
  ExtensionDocumentDataManager,
  ExtentionDocumentModelChangedEvent,
  VSCodeExtensionHostDocumentServicePath,
} from '../common';
import { ExtensionDocumentModelChangingEvent } from './event';

@Injectable()
export class ExtensionDocumentDataManagerImpl extends WithEventBus implements ExtensionDocumentDataManager {
  private _onModelChanged = new EventEmitter<ExtentionDocumentModelChangedEvent>();
  private onModelChanged = this._onModelChanged.event;

  @Autowired(VSCodeExtensionHostDocumentServicePath)
  readonly proxy: ExtensionDocumentDataManager;

  constructor() {
    super();

    this.onModelChanged((e: ExtentionDocumentModelChangedEvent) => {
      this.proxy.fireModelChangedEvent(e);
    });
  }

  fireModelChangedEvent(e: ExtentionDocumentModelChangedEvent) {
    this._onModelChanged.fire(e);
  }

  @OnEvent(ExtensionDocumentModelChangingEvent)
  onEditorModelChanged(e: ExtensionDocumentModelChangingEvent) {
    const { uri, changes, versionId, eol, dirty } = e.payload;
    this._onModelChanged.fire({
      uri: uri.toString(),
      changes,
      versionId,
      eol,
      dirty,
    });
  }
}
