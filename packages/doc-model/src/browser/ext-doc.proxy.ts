import { Emitter as EventEmitter, WithEventBus, OnEvent } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import {
  ExtensionDocumentDataManager,
  VSCodeExtensionHostDocumentServicePath,
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
} from '../common';
import {
  ExtensionDocumentModelChangingEvent,
  ExtensionDocumentModelOpeningEvent,
  ExtensionDocumentModelRemovingEvent,
  ExtensionDocumentModelSavingEvent,
} from './event';

@Injectable()
export class ExtensionDocumentDataManagerImpl extends WithEventBus {
  private _onModelChanged = new EventEmitter<ExtensionDocumentModelChangedEvent>();
  private _onModelOpened = new EventEmitter<ExtensionDocumentModelOpenedEvent>();
  private _onModelRemoved = new EventEmitter<ExtensionDocumentModelRemovedEvent>();
  private _onModelSaved = new EventEmitter<ExtensionDocumentModelSavedEvent>();

  private onModelChanged = this._onModelChanged.event;
  private onModelOpened = this._onModelOpened.event;
  private onModelRemoved = this._onModelRemoved.event;
  private onModelSaved = this._onModelSaved.event;

  @Autowired(VSCodeExtensionHostDocumentServicePath)
  readonly proxy: ExtensionDocumentDataManager;

  constructor() {
    super();

    this.onModelChanged((e: ExtensionDocumentModelChangedEvent) => {
      this.proxy.$fireModelChangedEvent(e);
    });

    this.onModelOpened((e: ExtensionDocumentModelOpenedEvent) => {
      console.log(this.proxy);
      this.proxy.$fireModelOpenedEvent(e);
    });

    this.onModelRemoved((e: ExtensionDocumentModelRemovedEvent) => {
      this.proxy.$fireModelRemovedEvent(e);
    });

    this.onModelSaved((e: ExtensionDocumentModelSavedEvent) => {
      this.proxy.$fireModelSavedEvent(e);
    });
  }

  $fireModelChangedEvent(e: ExtensionDocumentModelChangedEvent) {
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

  @OnEvent(ExtensionDocumentModelOpeningEvent)
  onEditorModelOpened(e: ExtensionDocumentModelOpeningEvent) {
    const { uri, lines, languageId, versionId, eol, dirty } = e.payload;
    this._onModelOpened.fire({
      uri: uri.toString(),
      lines,
      languageId,
      versionId,
      eol,
      dirty,
    });
  }

  @OnEvent(ExtensionDocumentModelRemovingEvent)
  onEditorModelRemoved(e: ExtensionDocumentModelRemovingEvent) {
    const { uri } = e.payload;
    this._onModelRemoved.fire({
      uri: uri.toString(),
    });
  }

  @OnEvent(ExtensionDocumentModelSavingEvent)
  onEditorModelSaved(e: ExtensionDocumentModelSavingEvent) {
    const { uri } = e.payload;
    this._onModelSaved.fire({
      uri: uri.toString(),
    });
  }
}
