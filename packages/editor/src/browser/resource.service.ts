import { ResourceService, IResource, IResourceProvider } from '../common';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, IDisposable, getLogger } from '@ali/ide-core-browser';

@Injectable()
export class ResourceServiceImpl implements ResourceService {

  private providers: Map<string, IResourceProvider> = new Map();

  constructor() {

  }

  async getResource(uri: URI): Promise<IResource<any> | null> {
    const provider = this.providers.get(uri.scheme);
    if (!provider) {
      getLogger().error('URI has no resource provider: ' + uri);
      return null; // no provider
    } else {
      return provider.provideResource(uri);
    }
  }

  registerResourceProvider(provider: IResourceProvider): IDisposable {
    const scheme = provider.scheme;
    this.providers.set(scheme, provider);
    return {
      dispose: () => {
        if (this.providers.get(scheme) === provider) {
          this.providers.delete(scheme);
        }
      },
    };
  }
}
