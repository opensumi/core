import { Autowired, Injectable } from '@ali/common-di';
import { IDocumentModelManager } from '../common';
import { IReference } from '@ali/ide-core-common/lib/lifecycle';

@Injectable()
export class MonacoTextModelService implements monaco.editor.ITextModelService {
  @Autowired(IDocumentModelManager)
  documentModelManager: IDocumentModelManager;

  async createModelReference(resource: monaco.Uri) {
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
      }) as any;
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
