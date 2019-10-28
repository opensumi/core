import { Injectable, Autowired } from '@ali/common-di';
import { URI, IDisposable, IEventBus } from '@ali/ide-core-browser';

import { IEditorDocumentModelContentRegistry, IEditorDocumentModelContentProvider, EditorDocumentModelOptionExternalUpdatedEvent } from './types';

@Injectable()
export class EditorDocumentModelContentRegistryImpl implements IEditorDocumentModelContentRegistry {

  private providers: IEditorDocumentModelContentProvider[] = [];

  @Autowired(IEventBus)
  eventBus: IEventBus;

  registerEditorDocumentModelContentProvider(provider: IEditorDocumentModelContentProvider): IDisposable {
    this.providers.push(provider);
    const disposer = provider.onDidChangeContent((uri) => {
      this.eventBus.fire(new EditorDocumentModelOptionExternalUpdatedEvent(uri));
    });
    return {
      dispose: () => {
        disposer.dispose();
        const index = this.providers.indexOf(provider);
        if (index) {
          this.providers.splice(index, 1);
        }
      },
    };
  }

  getProvider(uri: URI): IEditorDocumentModelContentProvider | undefined {
    for (const p of this.providers) {
      if (p.handlesScheme(uri.scheme)) {
        return p;
      }
    }
  }

  async getContentForUri(uri: URI, encoding?: string ): Promise<string> {
    const p = this.getProvider(uri);
    if (!p) {
      throw new Error();
    }
    return p.provideEditorDocumentModelContent(uri, encoding);
  }

}
