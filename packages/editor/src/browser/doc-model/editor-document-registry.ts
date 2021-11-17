import { Injectable, Autowired } from '@ide-framework/common-di';
import { URI, IDisposable, IEventBus, Emitter, LRUMap } from '@ide-framework/ide-core-browser';

import { IEditorDocumentModelContentRegistry, IEditorDocumentModelContentProvider, EditorDocumentModelOptionExternalUpdatedEvent, ORIGINAL_DOC_SCHEME } from './types';

@Injectable()
export class EditorDocumentModelContentRegistryImpl implements IEditorDocumentModelContentRegistry {

  private providers: IEditorDocumentModelContentProvider[] = [];

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private _onOriginalDocChanged: Emitter<URI> = new Emitter();

  private originalProvider: IEditorDocumentModelContentProvider;

  private cachedProviders = new LRUMap<string, Promise<IEditorDocumentModelContentProvider | undefined>>(1000, 500);

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
    this.cachedProviders.clear();
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
          this.cachedProviders.clear();
        }
      },
    };
  }

  getProvider(uri: URI): Promise<IEditorDocumentModelContentProvider | undefined> {
    const uriStr = uri.toString();
    if (!this.cachedProviders.has(uriStr)) {
      this.cachedProviders.set(uriStr, this.calculateProvider(uri));
    }
    return this.cachedProviders.get(uriStr)!;
  }

  // Ant Codespaces 需要使用该方法复写 getProvider，不使用缓存 provider
  protected async calculateProvider(uri: URI): Promise<IEditorDocumentModelContentProvider | undefined> {
    let calculated: {
      provider: IEditorDocumentModelContentProvider | undefined,
      weight: number,
      index: number,
    } = {
      provider: undefined,
      weight: -1,
      index: 1,
    };
    for (const provider of this.providers) {
      let weight = -1;
      const index = this.providers.indexOf(provider);
      if (provider.handlesUri) {
        weight = await provider.handlesUri(uri);
      } else if (provider.handlesScheme) {
        weight = (await provider.handlesScheme(uri.scheme) ) ? 10 : -1;
      }

      if (weight >= 0) {
        if (weight > calculated.weight || (weight === calculated.weight && index > calculated.index ) ) {
          calculated = {
            index,
            weight,
            provider,
          };
        }
      }
    }
    return calculated.provider;
  }

  async getContentForUri(uri: URI, encoding?: string): Promise<string> {
    const p = await this.getProvider(uri);
    if (!p) {
      throw new Error();
    }
    return p.provideEditorDocumentModelContent(uri, encoding);
  }
}
