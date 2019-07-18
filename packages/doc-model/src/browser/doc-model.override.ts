import { Autowired, Injectable } from '@ali/common-di';
import { DocumentModelManager } from './doc-manager';

@Injectable()
export class MonacoTextModelService implements monaco.editor.ITextModelService {
  @Autowired()
  documentModelManager: DocumentModelManager;

  // FIXME 与monaco 14版本类型不兼容
  // @ts-ignore
  async createModelReference(resource: monaco.Uri): Promise<any> {
    const docModel = await this.documentModelManager.resolveModel(resource.toString());
    if (docModel) {
      const model = docModel.toEditor();
      return Promise.resolve({
        object: {
          textEditorModel: model,
        },
        dispose: () => {
          console.log('TODO: dispose should be supported by reference');
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
