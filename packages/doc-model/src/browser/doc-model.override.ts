import { Autowired, Injectable } from '@ali/common-di';
import { BrowserDocumentModelManager } from './doc-model';

@Injectable()
export class MonacoTextModelService implements monaco.editor.ITextModelService {
  @Autowired()
  documentModelManager: BrowserDocumentModelManager;

  async createModelReference(resource: monaco.Uri): Promise<any> {
    const docModel = await this.documentModelManager.resolve(resource.toString());
    if (docModel) {
      const model = docModel.toEditor();
      return Promise.resolve({
        object: {
          textEditorModel: model,
        },
        dispose: () => {
          console.log('TODO: dispose support by reference');
          model.dispose();
        },
      });
    }
  }

  registerTextModelContentProvider(scheme: string, provider: monaco.editor.ITextModelContentProvider): monaco.IDisposable {
    return {
      dispose(): void {
        // no-op
      },
    };
  }
}
