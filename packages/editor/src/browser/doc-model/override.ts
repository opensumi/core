/* istanbul ignore file */
import { Autowired, Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-browser';
import {
  ITextModelService,
  ITextModelContentProvider,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/resolverService';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { IEditorDocumentModelService } from './types';

@Injectable()
export class MonacoTextModelService implements ITextModelService {
  canHandleResource(resource: any): boolean {
    return true;
  }

  hasTextModelContentProvider(scheme: string): boolean {
    throw new Error('Method not implemented.');
  }

  _serviceBrand: undefined;

  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  async createModelReference(resource: monaco.Uri) {
    const docModelRef = await this.documentModelManager.createModelReference(new URI(resource.toString()), 'monaco');
    if (docModelRef) {
      const model = docModelRef.instance.getMonacoModel();
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

  registerTextModelContentProvider(scheme: string, provider: ITextModelContentProvider): monaco.IDisposable {
    return {
      dispose(): void {
        // no-op
      },
    };
  }
}
