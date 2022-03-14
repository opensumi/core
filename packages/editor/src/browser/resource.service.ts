import { observable } from 'mobx';

import { Injectable, Autowired } from '@opensumi/di';
import { URI, IDisposable, WithEventBus, OnEvent } from '@opensumi/ide-core-browser';
import { Disposable, addElement, LRUMap, ILogger, Emitter } from '@opensumi/ide-core-common';

import {
  ResourceService,
  IResource,
  IResourceProvider,
  ResourceNeedUpdateEvent,
  ResourceDidUpdateEvent,
  IResourceDecoration,
  ResourceDecorationNeedChangeEvent,
  ResourceDecorationChangeEvent,
} from '../common';

@Injectable()
export class ResourceServiceImpl extends WithEventBus implements ResourceService {
  private providers: IResourceProvider[] = [];

  private resources: Map<
    string,
    {
      resource: IResource;
      provider: IResourceProvider;
    }
  > = new Map();

  private gettingResources: Map<
    string,
    Promise<{
      resource: IResource;
      provider: IResourceProvider;
    } | null>
  > = new Map();

  private resourceDecoration: Map<string, IResourceDecoration> = new Map();

  private cachedProvider = new LRUMap<string, IResourceProvider | undefined>(500, 200);

  private onRegisterResourceProviderEmitter = new Emitter<IResourceProvider>();
  public readonly onRegisterResourceProvider = this.onRegisterResourceProviderEmitter.event;

  private onUnregisterResourceProviderEmitter = new Emitter<IResourceProvider>();
  public readonly onUnregisterResourceProvider = this.onUnregisterResourceProviderEmitter.event;

  @Autowired(ILogger)
  logger: ILogger;

  constructor() {
    super();
  }

  @OnEvent(ResourceNeedUpdateEvent)
  onResourceNeedUpdateEvent(e: ResourceNeedUpdateEvent) {
    const uri = e.payload;
    if (this.resources.has(uri.toString())) {
      const resource = this.resources.get(uri.toString());
      this.doGetResource(uri).then((newResource) => {
        if (resource) {
          Object.assign(resource?.resource, newResource?.resource);
          resource.provider = newResource?.provider!;
        }
        this.eventBus.fire(new ResourceDidUpdateEvent(uri));
      });
    }
  }

  @OnEvent(ResourceDecorationNeedChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationNeedChangeEvent) {
    this.getResourceDecoration(e.payload.uri); // ensure object
    let changed = false;
    const previous = this.resourceDecoration.get(e.payload.uri.toString()) || {};
    new Set([...Object.keys(previous), ...Object.keys(e.payload.decoration)]).forEach((key) => {
      if (previous[key] !== e.payload.decoration[key]) {
        changed = true;
      }
    });
    if (changed) {
      Object.assign(this.resourceDecoration.get(e.payload.uri.toString()), e.payload.decoration);
      this.eventBus.fire(new ResourceDecorationChangeEvent(e.payload));
    }
  }

  async getResource(uri: URI): Promise<IResource<any> | null> {
    if (!this.resources.has(uri.toString())) {
      const r = await this.doGetResource(uri);
      if (!r) {
        return null;
      }
      const resource = {
        resource: observable(Object.assign({}, r.resource)),
        provider: r.provider,
      };
      this.resources.set(uri.toString(), resource);
    }
    return this.resources.get(uri.toString())!.resource as IResource;
  }

  handlesUri(uri: URI): boolean {
    const provider = this.calculateProvider(uri);
    return !!provider;
  }

  async doGetResource(uri: URI): Promise<{
    resource: IResource<any>;
    provider: IResourceProvider;
  } | null> {
    if (!this.gettingResources.has(uri.toString())) {
      const promise = (async () => {
        const provider = this.calculateProvider(uri);
        if (!provider) {
          this.logger.error('URI has no resource provider: ' + uri);
          return null;
        } else {
          const r = await provider.provideResource(uri);
          r.uri = uri;
          return {
            resource: r,
            provider,
          };
        }
      })();
      this.gettingResources.set(uri.toString(), promise);
      promise.finally(() => {
        this.gettingResources.delete(uri.toString());
      });
    }
    return this.gettingResources.get(uri.toString())!;
  }

  registerResourceProvider(provider: IResourceProvider): IDisposable {
    this.onRegisterResourceProviderEmitter.fire(provider);
    const disposer = new Disposable();
    disposer.addDispose(addElement(this.providers, provider));
    disposer.addDispose({
      dispose: () => {
        for (const r of this.resources.values()) {
          if (r.provider === provider) {
            r.provider = GhostResourceProvider;
            this.onUnregisterResourceProviderEmitter.fire(provider);
          }
        }
        this.cachedProvider.clear();
      },
    });
    this.cachedProvider.clear();
    return disposer;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    const provider = this.getProvider(resource.uri);
    if (!provider || !provider.shouldCloseResource) {
      return true;
    } else {
      return await provider.shouldCloseResource(resource, openedResources);
    }
  }

  private calculateProvider(uri: URI): IResourceProvider | undefined {
    if (this.cachedProvider.has(uri.toString())) {
      return this.cachedProvider.get(uri.toString());
    }
    let currentProvider: IResourceProvider | undefined;
    let currentComparator: {
      weight: number;
      index: number;
    } = {
      weight: -1,
      index: -1,
    };

    function acceptProvider(provider: IResourceProvider, weight: number, index: number) {
      currentComparator = { weight, index };
      currentProvider = provider;
    }

    this.providers.forEach((provider, index) => {
      let weight = -1;
      if (provider.handlesUri) {
        weight = provider.handlesUri(uri);
      } else if (provider.scheme) {
        weight = provider.scheme === uri.scheme ? 10 : -1;
      }

      if (weight >= 0) {
        if (weight > currentComparator.weight) {
          acceptProvider(provider, weight, index);
        } else if (weight === currentComparator.weight && index > currentComparator.index) {
          acceptProvider(provider, weight, index);
        }
      }
    });

    this.cachedProvider.set(uri.toString(), currentProvider);

    return currentProvider;
  }

  private getProvider(uri: URI): IResourceProvider | undefined {
    const r = this.resources.get(uri.toString());
    if (r) {
      return r.provider;
    } else {
      return undefined;
    }
  }

  public getResourceDecoration(uri: URI): IResourceDecoration {
    if (!this.resourceDecoration.has(uri.toString())) {
      this.resourceDecoration.set(uri.toString(), observable(DefaultResourceDecoration));
    }
    return this.resourceDecoration.get(uri.toString()) as IResourceDecoration;
  }

  getResourceSubname(resource: IResource<any>, groupResources: IResource<any>[]): string | null {
    const provider = this.getProvider(resource.uri);
    if (!provider) {
      this.logger.error('URI has no resource provider: ' + resource.uri);
      return null; // no provider
    } else if (!provider.provideResourceSubname) {
      return null;
    } else {
      return provider.provideResourceSubname(resource, groupResources);
    }
  }

  disposeResource(resource: IResource<any>) {
    const provider = this.getProvider(resource.uri);
    this.resources.delete(resource.uri.toString());
    if (!provider || !provider.onDisposeResource) {
      return;
    } else {
      return provider.onDisposeResource(resource);
    }
  }
}

const DefaultResourceDecoration: IResourceDecoration = {
  dirty: false,
};

const GhostResourceProvider: IResourceProvider = {
  handlesUri: () => -1,
  provideResource: (uri: URI) => ({ uri, name: '', icon: '' }),
};
