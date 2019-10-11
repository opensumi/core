import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ResourceService, IResourceProvider, ResourceDecorationChangeEvent, ResourceNeedUpdateEvent, ResourceDidUpdateEvent } from '../../src';
import { ResourceServiceImpl } from '../../src/browser/resource.service';
import { URI, IEventBus } from '@ali/ide-core-common';

describe('resource service tests', () => {

  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: ResourceService,
    useClass : ResourceServiceImpl,
  });

  let data = 0;

  const TestResourceProvider1: IResourceProvider = {
    scheme: 'test',
    provideResource: (uri: URI) => {
      return {
        uri,
        name: uri.path.toString(),
        icon: 'iconTest ' + uri.toString(),
        metadata: {
          data,
        },
      };
    },
    provideResourceSubname: (resource, groups) => {
      if (groups.filter((r) => r.uri.isEqual(resource.uri)).length > 1) {
        return 'more than one';
      } else {
        return null;
      }
    },
    shouldCloseResource: (resource, openedResources) => {
      if (openedResources.length > 1) {
        return false;
      } else {
        return true;
      }
    },
  };

  const TestResourceProvider2: IResourceProvider = {
    scheme: 'test2',
    provideResource: (uri: URI) => {
      return {
        uri,
        name: uri.path.toString(),
        icon: 'iconTest2 ' + uri.toString(),
      };
    },
  };

  it('should be able to resolve resource provided by provider', async (done) => {

    const service: ResourceService = injector.get(ResourceService);
    const disposer = service.registerResourceProvider(TestResourceProvider1);
    const disposer2 = service.registerResourceProvider(TestResourceProvider2);

    const resUri = new URI('test://testResource1');
    const resource = await service.getResource(resUri);

    expect(resource).toBeDefined();

    expect(resource!.name).toBe(resUri.path.toString());
    expect(resource!.icon).toBe('iconTest ' + resUri.toString());

    expect(resource!.uri.toString()).toBe(resUri.toString());

    expect(await service.getResourceSubname(resource!, [resource!, resource!])).toBe('more than one');
    expect(await service.getResourceSubname(resource!, [resource!])).toBeNull();

    const resUri2 = new URI('test2://testResource2');
    const resource2 = await service.getResource(resUri2);

    expect(resource2).toBeDefined();

    expect(resource2!.name).toBe(resUri2.path.toString());
    expect(resource2!.icon).toBe('iconTest2 ' + resUri2.toString());
    expect(await service.getResourceSubname(resource2!, [resource2!])).toBeNull();

    disposer.dispose();
    disposer2.dispose();

    expect(await service.getResource(new URI('test://testResource1'))).not.toBeNull(); // 存在缓存
    expect(await service.getResourceSubname(resource!, [])).toBeNull();
    expect(await service.getResource(new URI('test://testResource2'))).toBeNull();

    done();

  });

  it('should return null when resource is not provided', async (done) => {

    const service: ResourceService = injector.get(ResourceService);
    expect(await service.getResource(new URI('what://not-provided'))).toBeNull();

    done();

  });

  it('should update resource decoration after events', () => {
    const service: ResourceService = injector.get(ResourceService);
    const disposer = service.registerResourceProvider(TestResourceProvider1);

    const resUri = new URI('test://testResource1');

    expect(service.getResourceDecoration(resUri).dirty).toBeFalsy();

    const eventBus: IEventBus = injector.get(IEventBus);

    eventBus.fire(new ResourceDecorationChangeEvent({
      uri: resUri,
      decoration: {
        dirty: true,
      },
    }));

    expect(service.getResourceDecoration(resUri).dirty).toBeTruthy();

    eventBus.fire(new ResourceDecorationChangeEvent({
      uri: resUri,
      decoration: {
        dirty: false,
      },
    }));

    expect(service.getResourceDecoration(resUri).dirty).toBeFalsy();

    disposer.dispose();
  });

  it('should be able to prevent resource close', async (done) => {

    const service: ResourceService = injector.get(ResourceService);
    const disposer = service.registerResourceProvider(TestResourceProvider1);
    const disposer2 = service.registerResourceProvider(TestResourceProvider2);

    const resUri = new URI('test://testResource1');
    const resource = await service.getResource(resUri);

    expect(await service.shouldCloseResource(resource!, [])).toBeTruthy();
    expect(await service.shouldCloseResource(resource!, [[], []])).toBeFalsy();

    const resUri2 = new URI('test2://testResource2');
    const resource2 = await service.getResource(resUri2);

    expect(await service.shouldCloseResource(resource2!, [[], []])).toBeTruthy();

    disposer.dispose();
    disposer2.dispose();

    done();
  });

  it('should fire need didUpdateEvent', async (done) => {

    const service: ResourceService = injector.get(ResourceService);
    const disposer = service.registerResourceProvider(TestResourceProvider1);

    const resUri = new URI('test://testResource1');
    const resource = await service.getResource(resUri);

    expect(resource!.metadata!.data).toBe(0);

    const eventBus: IEventBus = injector.get(IEventBus);

    data ++;
    eventBus.fire(new ResourceNeedUpdateEvent(resUri));

    eventBus.on(ResourceDidUpdateEvent, async (e) => {
      expect(e.payload.toString()).toEqual(resUri.toString());
      const newResource = await service.getResource(resUri);
      expect(newResource!.metadata!.data).toBe(1);
      done();
    });

    disposer.dispose();

  });

});
