import { ResourceService, IResource, IResourceProvider, ResourceUpdateEvent } from '../common';
import { Injectable, Autowired } from '@ali/common-di';
import { URI, IDisposable, getLogger } from '@ali/ide-core-browser';

@Injectable()
export class ResourceServiceImpl implements ResourceService {

  private providers: Map<string, IResourceProvider> = new Map();

  private resources: Map<string, IResource> = new Map();

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

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    const provider = this.providers.get(resource.uri.scheme);
    if (!provider || !provider.shouldCloseResource) {
      return true;
    } else {
      return await provider.shouldCloseResource(resource, openedResources);
    }
  }

}
