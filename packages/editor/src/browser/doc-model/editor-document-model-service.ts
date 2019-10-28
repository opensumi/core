import * as md5 from 'md5';
import { URI, IRef, ReferenceManager, IEditorDocumentChange, IEditorDocumentModelSaveResult, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';

import { IEditorDocumentModel, IEditorDocumentModelContentRegistry, IEditorDocumentModelService, EditorDocumentModelOptionExternalUpdatedEvent } from './types';
import { EditorDocumentModel } from './editor-document-model';

@Injectable()
export class EditorDocumentModelServiceImpl extends WithEventBus implements IEditorDocumentModelService {

  @Autowired(IEditorDocumentModelContentRegistry)
  contentRegistry: IEditorDocumentModelContentRegistry;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  private editorDocModels = new Map<string, EditorDocumentModel>();

  private creatingEditorModels = new Map<string, Promise<EditorDocumentModel>>();

  private _modelReferenceManager: ReferenceManager<EditorDocumentModel>;

  private _modelsToDispose = new Set<string>();

  constructor() {
    super();
    this._modelReferenceManager = new ReferenceManager<EditorDocumentModel>((key: string) => {
      if (this._modelsToDispose.has(key)) {
        this._modelsToDispose.delete(key);
      }
      return this.getOrCreateModel(key);
    });
    this._modelReferenceManager.onReferenceAllDisposed((key: string) => {
      this._delete(key);
    });
  }

  private _delete(uri: string | URI): void {
    // debounce
    this._modelsToDispose.add(uri.toString());
    setTimeout(() => {
      if (this._modelsToDispose.has(uri.toString())) {
        this._doDelete(uri.toString());
      }
    }, 3000);
  }

  private _doDelete(uri: string) {
    const doc = this.editorDocModels.get(uri);
    if (doc) {
      doc.dispose();
      this.editorDocModels.delete(uri);
      return doc;
    }
    this._modelsToDispose.delete(uri);
  }

  @OnEvent(EditorDocumentModelOptionExternalUpdatedEvent)
  async acceptExternalChange(e: EditorDocumentModelOptionExternalUpdatedEvent) {
    const doc = this.editorDocModels.get(e.payload.toString());
    if (doc) {
      if (doc.dirty) {
        // do nothing
      } else {
        const provider = this.contentRegistry.getProvider(doc.uri);
        if (provider) {
          if (provider.provideEditorDocumentModelContentMd5) {
            if (await provider.provideEditorDocumentModelContentMd5(doc.uri) !== doc.baseContentMd5) {
              doc.updateContent(await this.contentRegistry.getContentForUri(doc.uri), undefined, true);
            }
          } else {
            const content = await this.contentRegistry.getContentForUri(doc.uri);
            if (md5(content) !== doc.baseContentMd5) {
              doc.updateContent(content, undefined, true);
            }
          }
        }
      }
    }
  }

  createModelReference(uri: URI, reason?: string | undefined): Promise<IRef<IEditorDocumentModel>> {
    return this._modelReferenceManager.getReference(uri.toString(), reason);
  }

  getModelReference(uri: URI, reason?: string | undefined): IRef<IEditorDocumentModel> | null {
    return this._modelReferenceManager.getReferenceIfHasInstance(uri.toString(), reason);
  }

  getAllModels(): IEditorDocumentModel[] {
    return Array.from(this.editorDocModels.values());
  }

  async getOrCreateModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    if (this.editorDocModels.has(uri)) {
      return this.editorDocModels.get(uri)!;
    }
    return this.createModel(uri, encoding);
  }

  private createModel(uri: string, encoding?: string): Promise<EditorDocumentModel> {
    // 防止异步重复调用
    if (!this.creatingEditorModels.has(uri)) {
      const promise = this.doCreateModel(uri, encoding).then((model) => {
        this.creatingEditorModels.delete(uri);
        return model;
      }, (e) => {
        this.creatingEditorModels.delete(uri);
        throw e;
      });
      this.creatingEditorModels.set(uri, promise);
    }
    return this.creatingEditorModels.get(uri)!;
  }

  private async doCreateModel(uriString: string, encoding?: string): Promise<EditorDocumentModel> {
    const uri = new URI(uriString);
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }

    const [
      content,
      readonly,
      languageId,
      eol,
    ] = await Promise.all([
      (async () => provider.provideEditorDocumentModelContent(uri, encoding))(),
      (async () => provider.isReadonly ? provider.isReadonly(uri) : undefined)(),
      (async () => provider.preferLanguageForUri ? provider.preferLanguageForUri(uri) : undefined)(),
      (async () => provider.provideEOL ? provider.provideEOL(uri) : undefined)(),
    ]);

    const savable = !!provider.saveDocumentModel;

    const model = this.injector.get(EditorDocumentModel, [uri, content, {
      readonly,
      languageId,
      savable,
      eol,
      encoding,
    }]);

    this.editorDocModels.set(uri.toString(), model);
    return model;
  }

  async saveEditorDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding?: string): Promise<IEditorDocumentModelSaveResult> {
    const provider = this.contentRegistry.getProvider(uri);

    if (!provider) {
      throw new Error(`未找到${uri.toString()}的文档提供商`);
    }
    if (!provider.saveDocumentModel) {
      throw new Error(`${uri.toString()}的文档提供商不存在保存方法`);
    }

    const result = await provider.saveDocumentModel(uri, content, baseContent, changes, encoding);
    return result;
  }
}
