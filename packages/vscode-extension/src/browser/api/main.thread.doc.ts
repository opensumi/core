import { Emitter as EventEmitter, WithEventBus, OnEvent } from '@ali/ide-core-common';
import { ExtHostAPIIdentifier, IMainThreadDocumentsShape } from '../../common';
import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import {
  ExtensionDocumentDataManager,
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
  IDocumentModelManager,
} from '@ali/ide-doc-model';
import {
  ExtensionDocumentModelChangingEvent,
  ExtensionDocumentModelOpeningEvent,
  ExtensionDocumentModelRemovingEvent,
  ExtensionDocumentModelSavingEvent,
} from '@ali/ide-doc-model/lib/browser/event';

@Injectable()
export class MainThreadExtensionDocumentData extends WithEventBus implements IMainThreadDocumentsShape {
  private _onModelChanged = new EventEmitter<ExtensionDocumentModelChangedEvent>();
  private _onModelOpened = new EventEmitter<ExtensionDocumentModelOpenedEvent>();
  private _onModelRemoved = new EventEmitter<ExtensionDocumentModelRemovedEvent>();
  private _onModelSaved = new EventEmitter<ExtensionDocumentModelSavedEvent>();

  private onModelChanged = this._onModelChanged.event;
  private onModelOpened = this._onModelOpened.event;
  private onModelRemoved = this._onModelRemoved.event;
  private onModelSaved = this._onModelSaved.event;

  private readonly proxy: ExtensionDocumentDataManager;

  @Autowired(IDocumentModelManager)
  protected docManager: IDocumentModelManager;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();

    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostDocuments);

    this.onModelChanged((e: ExtensionDocumentModelChangedEvent) => {
      this.proxy.$fireModelChangedEvent(e);
    });

    this.onModelOpened((e: ExtensionDocumentModelOpenedEvent) => {
      console.log('this.onModelOpened', e);
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

  async $tryCreateDocument(options: { content: string, language: string }): Promise<string> {
    // TODO
    return Promise.resolve('');
  }

  async $tryOpenDocument(uri: string) {
    let doc = await this.docManager.searchModel(uri);

    if (!doc) {
      doc = await this.docManager.resolveModel(uri);
    }
  }

  async $trySaveDocument(uri: string) {
    return this.docManager.saveModel(uri);
  }
}
