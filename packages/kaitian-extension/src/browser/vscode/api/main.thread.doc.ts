import { Emitter as EventEmitter, WithEventBus, OnEvent, Event, URI, IDisposable, Disposable } from '@ali/ide-core-common';
import { ExtHostAPIIdentifier, IMainThreadDocumentsShape } from '../../../common/vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import {
  ExtensionDocumentDataManager,
  ExtensionDocumentModelChangedEvent,
  ExtensionDocumentModelOpenedEvent,
  ExtensionDocumentModelRemovedEvent,
  ExtensionDocumentModelSavedEvent,
  IDocumentModelManager,
  IDocumentModelContentProvider,
  IDocumentChangedEvent,
  IDocumentCreatedEvent,
  IDocumentRenamedEvent,
  IDocumentRemovedEvent,
  Version,
  VersionType,
  IDocumentModelRef,
} from '@ali/ide-doc-model';
import {
  ExtensionDocumentModelChangingEvent,
  ExtensionDocumentModelOpeningEvent,
  ExtensionDocumentModelRemovingEvent,
  ExtensionDocumentModelSavingEvent,
} from '@ali/ide-doc-model/lib/browser/event';
import { Schemas } from '../../../common/vscode/ext-types';
import { IDocumentModelManagerImpl } from '@ali/ide-doc-model/lib/browser/types';
import { ResourceService } from '@ali/ide-editor';
import { EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';

const DEFAULT_EXT_HOLD_DOC_REF_MAX_AGE = 1000 * 60 * 3; // 插件进程openDocument持有的最长时间
const DEFAULT_EXT_HOLD_DOC_REF_MIN_AGE = 1000 * 20; // 插件进程openDocument持有的最短时间，防止bounce
const DEFAULT_EXT_HOLD_DOC_REF_LENGTH = 1024 * 1024 * 80; // 插件进程openDocument持有的最长长度

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

  private tempDocIdCount = 0;

  private readonly proxy: ExtensionDocumentDataManager;

  @Autowired(IDocumentModelManager)
  protected docManager: IDocumentModelManagerImpl;

  @Autowired()
  private resourceService: ResourceService;

  @Autowired()
  private editorComponentRegistry: EditorComponentRegistry;

  @Autowired()
  labelService: LabelService;

  protected provider: ExtensionProvider;

  private editorDisposers: Map<string, IDisposable> = new Map();

  private extHoldDocuments = new LimittedMainThreadDocumentCollection();

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();

    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostDocuments);
    this.provider = new ExtensionProvider(this.proxy);
    this.docManager.registerDocModelContentProvider(this.provider);

    this.onModelChanged((e: ExtensionDocumentModelChangedEvent) => {
      this.proxy.$fireModelChangedEvent(e);
    });

    this.onModelOpened((e: ExtensionDocumentModelOpenedEvent) => {
      this.proxy.$fireModelOpenedEvent(e);
    });

    this.onModelRemoved((e: ExtensionDocumentModelRemovedEvent) => {
      this.proxy.$fireModelRemovedEvent(e);
    });

    this.onModelSaved((e: ExtensionDocumentModelSavedEvent) => {
      this.proxy.$fireModelSavedEvent(e);
    });

    // sync
    this.docManager.getAllModels()
      .map((doc) => {
        this.proxy.$fireModelOpenedEvent({
          uri: doc.uri.toString(),
          lines: doc.lines,
          eol: doc.eol,
          dirty: doc.dirty,
          languageId: doc.language,
          versionId: doc.toEditor().getVersionId(),
        });
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
    const { language, content } = options;
    const docRef = await this.docManager.createModelReference(new URI(`${Schemas.untitled}://temp/` + (this.tempDocIdCount++)), 'ext-create-document');
    docRef.instance.language = language;
    docRef.instance.setValue(content);
    return docRef.instance.uri.toString();
  }

  async $tryOpenDocument(uri: string) {
    const docRef = await this.docManager.createModelReference(new URI(uri), 'ext-open-document');
    this.extHoldDocuments.add(docRef);
  }

  async $trySaveDocument(uri: string) {
    return this.docManager.saveModel(uri);
  }

  async $fireTextDocumentChangedEvent(uri: string, content: string) {
    this.provider.fireChangeEvent(uri, content);
  }

  $unregisterDocumentProviderWithScheme(scheme: string) {
    if (this.editorDisposers.has(scheme)) {
      this.editorDisposers.get(scheme)!.dispose();
      this.editorDisposers.delete(scheme);
    }
  }

  $registerDocumentProviderWithScheme(scheme: string) {
    this.$unregisterDocumentProviderWithScheme(scheme);
    const disposer = new Disposable();
    disposer.addDispose(this.resourceService.registerResourceProvider({
      scheme,
      provideResource: async (uri) => {
        return Promise.all([this.labelService.getName(uri), this.labelService.getIcon(uri)]).then(([name, icon]) => {
          return {
            name,
            icon,
            uri,
            metadata: null,
          };
        });
      },
    }));
    disposer.addDispose(this.editorComponentRegistry.registerEditorComponentResolver(scheme, (resource, results) => {
      results.push({
        type: 'code',
        readonly: true,
      });
    }));
  }

}

export class ExtensionProvider implements IDocumentModelContentProvider {
  static _noop = () => {};
  static _eol = '\n';

  private readonly proxy: ExtensionDocumentDataManager;

  private _onChanged = new EventEmitter<IDocumentChangedEvent>();
  public onChanged: Event<IDocumentChangedEvent> = this._onChanged.event;
  public onCreated: Event<IDocumentCreatedEvent> = Event.None;
  public onRenamed: Event<IDocumentRenamedEvent> = Event.None;
  public onRemoved: Event<IDocumentRemovedEvent> = Event.None;

  constructor(_proxy: ExtensionDocumentDataManager) {
    this.proxy = _proxy;
  }

  private _content2mirror(uri: string, content: string) {
    return {
      uri: uri.toString(),
      lines: content.split(ExtensionProvider._eol),
      base: Version.init(VersionType.raw),
      eol: ExtensionProvider._eol,
      encoding: 'utf-8',
      language: 'plaintext',
      readonly: true,
    };
  }

  fireChangeEvent(uri: string, content: string) {
    this._onChanged.fire({
      uri: new URI(uri),
      mirror: this._content2mirror(uri, content),
    });
  }

  async build(uri: URI) {
    const content = await this.proxy.$provideTextDocumentContent(uri.toString(), null);

    if (content) {
      return this._content2mirror(uri.toString(), content);
    }
  }

  async persist() {
    return null;
  }
}

class LimittedMainThreadDocumentCollection {

  private maxLength = DEFAULT_EXT_HOLD_DOC_REF_LENGTH;
  private maxAge = DEFAULT_EXT_HOLD_DOC_REF_MAX_AGE;
  private minAge = DEFAULT_EXT_HOLD_DOC_REF_MIN_AGE;

  private refs: {
    ref: IDocumentModelRef,
    dispose(): void;
    createTimeStamp: number;
  }[] = [];

  private length: number = 0;

  public add(docRef: IDocumentModelRef) {
    const length = docRef.instance.getText().length; // 只使用openDocument时的length，这个length之后可能会改变，但不管
    this.length += length;
    let maxTimeout: any = null;
    const ref = {
      ref: docRef,
      dispose: () => {
        const index = this.refs.indexOf(ref);
        if (index !== 0) {
          this.length -= length;
          docRef.dispose();
          clearTimeout(maxTimeout!);
          this.refs.splice(index, 1);
        }
      },
      createTimeStamp: new Date().getTime(),
    };

    maxTimeout = setTimeout(() => {
      ref.dispose();
    }, this.maxAge);

    this.refs.push(ref);
    this.clean();
  }

  private clean() {
    // 这里如果只有一个ref，就不dispose了，不然容易出现反复打开关闭
    while (this.length > this.maxLength && this.refs.length > 1) {
      const toDispose = this.refs[0];
      if (toDispose.createTimeStamp + this.minAge > new Date().getTime()) {
        break; // 持有时间太短
      }
      this.disposeFirst();
    }
  }

  private disposeFirst() {
    const toDispose = this.refs.shift();
    if (toDispose) {
      toDispose.dispose();
    }
  }

}
