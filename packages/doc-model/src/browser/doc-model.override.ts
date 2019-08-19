import { Autowired, Injectable } from '@ali/common-di';
import { IDocumentModelManager } from '../common';
import { URI } from '@ali/ide-core-browser';

@Injectable()
export class MonacoTextModelService implements monaco.editor.ITextModelService {
  @Autowired(IDocumentModelManager)
  documentModelManager: IDocumentModelManager;

  async createModelReference(resource: monaco.Uri) {
    const docModelRef = await this.documentModelManager.createModelReference(new URI(resource.toString()), 'monaco');
    if (docModelRef) {
      const model = docModelRef.instance.toEditor();
      return Promise.resolve({
        object: {
          textEditorModel: model,
        },
        dispose: () => {
          docModelRef.dispose();
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
