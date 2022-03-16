import { AppConfig, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { URI, IEventBus, Schemas, ILoggerManagerClient } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService, ICompareService } from '@opensumi/ide-editor/lib/browser';
import { DiffResourceProvider, DefaultDiffEditorContribution } from '@opensumi/ide-editor/lib/browser/diff';
import { CompareService } from '@opensumi/ide-editor/lib/browser/diff/compare';
import { UntitledSchemeDocumentProvider } from '@opensumi/ide-editor/lib/browser/untitled-resource';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import {
  ResourceService,
  IResourceProvider,
  ResourceDecorationNeedChangeEvent,
  ResourceDecorationChangeEvent,
  ResourceNeedUpdateEvent,
  ResourceDidUpdateEvent,
  WorkbenchEditorService,
} from '../../src';
import { ResourceServiceImpl } from '../../src/browser/resource.service';

describe('resource service tests', () => {
  const injector = createBrowserInjector([]);

  injector.addProviders(
    {
      token: ResourceService,
      useClass: ResourceServiceImpl,
    },
    {
      token: ILoggerManagerClient,
      useValue: {
        getLogger: () => ({
          log() {},
          debug() {},
          error() {},
          verbose() {},
          warn() {},
        }),
      },
    },
  );

  let data = 0;

  const TestResourceProvider1: IResourceProvider = {
    scheme: 'test',
    provideResource: (uri: URI) => ({
      uri,
      name: uri.path.toString(),
      icon: 'iconTest ' + uri.toString(),
      metadata: {
        data,
      },
    }),
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
    provideResource: (uri: URI) => ({
      uri,
      name: uri.path.toString(),
      icon: 'iconTest2 ' + uri.toString(),
    }),
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

    const changedListener = jest.fn();

    const disposer2 = eventBus.on(ResourceDecorationChangeEvent, changedListener);

    eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: resUri,
        decoration: {
          dirty: true,
        },
      }),
    );

    expect(service.getResourceDecoration(resUri).dirty).toBeTruthy();
    expect(changedListener).toBeCalledWith(
      expect.objectContaining({ payload: { uri: resUri, decoration: { dirty: true } } }),
    );

    changedListener.mockClear();
    eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: resUri,
        decoration: {
          dirty: false,
        },
      }),
    );

    expect(service.getResourceDecoration(resUri).dirty).toBeFalsy();
    expect(changedListener).toBeCalledWith(
      expect.objectContaining({ payload: { uri: resUri, decoration: { dirty: false } } }),
    );

    disposer.dispose();
    disposer2.dispose();
  });

  it('should be able to prevent resource close', async (done) => {
    const service: ResourceService = injector.get(ResourceService);
    const disposer = service.registerResourceProvider(TestResourceProvider1);
    const disposer2 = service.registerResourceProvider(TestResourceProvider2);

    const resUri = new URI('test://testResource12');
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

    data++;
    eventBus.fire(new ResourceNeedUpdateEvent(resUri));

    eventBus.on(ResourceDidUpdateEvent, async (e) => {
      expect(e.payload.toString()).toEqual(resUri.toString());
      const newResource = await service.getResource(resUri);
      expect(newResource!.metadata!.data).toBe(1);
      done();
    });

    disposer.dispose();
  });

  it('untitled resource test', async (done) => {
    injector.mockService(IEditorDocumentModelService);
    injector.mockService(WorkbenchEditorService);
    injector.mockService(AppConfig, {
      workspaceDir: '/TEST_WORKSPACE',
    });
    const mockSave = jest.fn(() => new URI('file:///test/test-untitled.saved.js'));
    injector.mockCommand('file.save', mockSave);

    const provider = injector.get(UntitledSchemeDocumentProvider);

    const untitledURI = URI.from({
      scheme: Schemas.untitled,
      authority: 'test',
      path: '/test.js',
      query: 'name=test.js',
    });

    expect(provider.isReadonly(untitledURI)).toBeFalsy();

    expect(provider.isAlwaysDirty(untitledURI)).toBeTruthy();

    expect(provider.handlesScheme(Schemas.untitled)).toBeTruthy();
    expect(provider.handlesScheme(Schemas.file)).toBeFalsy();

    expect(await provider.provideEditorDocumentModelContent(untitledURI)).toBe('');

    expect(await provider.closeAutoSave(untitledURI)).toBe(true);

    await provider.saveDocumentModel(untitledURI, 'test document', '', [], 'utf8');

    expect(mockSave).toBeCalled();

    done();
  });

  it('diff resource tests', async (done) => {
    injector.mockService(LabelService, {
      getIcon: jest.fn((uri) => uri.toString()),
    });

    const provider = injector.get(DiffResourceProvider);

    expect(provider.scheme).toBe('diff');
    const diffUri = new URI(
      'diff://?name=a.ts(on disk)<>a.ts&original=file://path/to/a.ts&modified=fileOnDisk://path/to/a.ts',
    );
    const res = await provider.provideResource(diffUri);
    expect(res.name).toBe('a.ts(on disk)<>a.ts');
    expect(res.icon).toBe('file://path/to/a.ts');
    expect(res.metadata!.original.toString()).toBe('file://path/to/a.ts');
    expect(res.metadata!.modified.toString()).toBe('fileOnDisk://path/to/a.ts');

    injector.mock(
      ResourceService,
      'shouldCloseResource',
      jest.fn(() => true),
    );

    injector.mock(
      ResourceService,
      'getResource',
      jest.fn(() => ({})),
    );

    const resourceService: ResourceService = injector.get(ResourceService);

    expect(await provider.shouldCloseResource(res, [[]])).toBe(true);
    expect(resourceService.getResource).toBeCalled();
    expect(resourceService.shouldCloseResource).toBeCalled();

    const eventBus: IEventBus = injector.get(IEventBus);

    let diffDirtyChanged = false;
    const listener = (e: ResourceDecorationChangeEvent) => {
      if (e.payload.uri.toString() === diffUri.toString()) {
        diffDirtyChanged = true;
      }
    };
    eventBus.on(ResourceDecorationChangeEvent, listener);

    eventBus.fire(
      new ResourceDecorationChangeEvent({
        uri: new URI('fileOnDisk://path/to/a.ts'),
        decoration: {
          dirty: true,
        },
      }),
    );

    expect(diffDirtyChanged).toBeTruthy();

    const contribution = injector.get(DefaultDiffEditorContribution);

    contribution.registerResource(resourceService);

    const schemes = new Map<string, any>();

    contribution.registerEditorComponent({
      registerEditorComponentResolver: (scheme, v) => {
        schemes.set(scheme, v);
      },
    } as any);

    expect(schemes.has('diff')).toBeTruthy();

    injector.mockCommand(EDITOR_COMMANDS.CLOSE_ALL.id, jest.fn());
    let openingResource: URI | null = null;
    injector.mockCommand(
      EDITOR_COMMANDS.OPEN_RESOURCE.id,
      jest.fn((uri) => {
        openingResource = uri;
      }),
    );

    injector.addProviders({
      token: ICompareService,
      useClass: CompareService,
    });

    const compareService: ICompareService = injector.get(ICompareService);

    compareService.compare(res.metadata!.original, res.metadata!.modified, 'compare test');
    expect(openingResource).toBeDefined();
    const res2 = await provider.provideResource(openingResource!);
    expect(res2.metadata!.original.toString()).toBe('file://path/to/a.ts');
    expect(res2.metadata!.modified.toString()).toBe('fileOnDisk://path/to/a.ts');

    done();
  });

  afterAll(() => {
    injector.disposeAll();
  });
});
