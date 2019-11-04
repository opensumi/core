import { Injectable, Autowired } from '@ali/common-di';
import { URI, IDisposable, IEventBus, Emitter } from '@ali/ide-core-browser';

import { IEditorDocumentModelContentRegistry, IEditorDocumentModelContentProvider, EditorDocumentModelOptionExternalUpdatedEvent, ORIGINAL_DOC_SCHEME } from './types';

@Injectable()
export class EditorDocumentModelContentRegistryImpl implements IEditorDocumentModelContentRegistry {

  private providers: IEditorDocumentModelContentProvider[] = [];

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private _onOriginalDocChanged: Emitter<URI> = new Emitter();

  private originalProvider: IEditorDocumentModelContentProvider;

  constructor() {
    this.originalProvider = {
      handlesScheme: (scheme: string) => {
        return scheme === ORIGINAL_DOC_SCHEME;
      },
      provideEditorDocumentModelContent: async (uri: URI) => {
        const { target } = uri.getParsedQuery();
        const targetUri = new URI(target);
        return (await this.getContentForUri(targetUri)) || '';
      },
      isReadonly: () => {
        return true;
      },
      onDidChangeContent: this._onOriginalDocChanged.event,
    };
    this.registerEditorDocumentModelContentProvider(this.originalProvider);
  }

  registerEditorDocumentModelContentProvider(provider: IEditorDocumentModelContentProvider): IDisposable {
    this.providers.push(provider);
    const disposer = provider.onDidChangeContent((uri) => {
      this.eventBus.fire(new EditorDocumentModelOptionExternalUpdatedEvent(uri));
    });
    // 每次注册 doc content provider， 都同时注册一个用于取出原始文档内容的doc provider
    // 处理的doc uri为shadowed_前缀的scheme
    if (provider !== this.originalProvider && provider.onDidChangeContent) {
      provider.onDidChangeContent((uri) => {
        this._onOriginalDocChanged.fire(URI.from({
          scheme: ORIGINAL_DOC_SCHEME,
          query: URI.stringifyQuery({
            target: uri.toString(),
          }),
        }));
      });
    }
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
