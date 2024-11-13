import { AppConfig, EDITOR_COMMANDS } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { Deferred, IEventBus, Schemes, URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { ICompareService, IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { DefaultDiffEditorContribution, DiffResourceProvider } from '@opensumi/ide-editor/lib/browser/diff';
import { CompareService } from '@opensumi/ide-editor/lib/browser/diff/compare';
import { UntitledSchemeDocumentProvider } from '@opensumi/ide-editor/lib/browser/untitled-resource';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import {
  IResourceProvider,
  ResourceDecorationChangeEvent,
  ResourceDecorationNeedChangeEvent,
  ResourceDidUpdateEvent,
  ResourceNeedUpdateEvent,
  ResourceService,
  WorkbenchEditorService,
} from '../../src';
import { ResourceServiceImpl } from '../../src/browser/resource.service';

describe('resource service tests', () => {
  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: ResourceService,
    useClass: ResourceServiceImpl,
  });

  injector.addProviders({
    token: IWorkspaceService,
    useValue: {},
  });

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

  it('should be able to resolve resource provided by provider', async () => {
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
  });

  it('should return null when resource is not provided', async () => {
    const service: ResourceService = injector.get(ResourceService);
    expect(await service.getResource(new URI('what://not-provided'))).toBeNull();
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
    expect(changedListener).toHaveBeenCalledWith(
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
    expect(changedListener).toHaveBeenCalledWith(
      expect.objectContaining({ payload: { uri: resUri, decoration: { dirty: false } } }),
    );

    disposer.dispose();
    disposer2.dispose();
  });

  it('should be able to prevent resource close', async () => {
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
  });

  it('should fire need didUpdateEvent', async () => {
    expect.assertions(3);
    const defered = new Deferred();

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
      defered.resolve();
    });

    disposer.dispose();
    await defered.promise;
  });

  it('untitled resource test', async () => {
    injector.mockService(IEditorDocumentModelService);
    injector.mockService(WorkbenchEditorService);
    injector.mockService(AppConfig, {
      workspaceDir: '/TEST_WORKSPACE',
    });
    const mockSave = jest.fn(() => new URI('file:///test/test-untitled.saved.js'));
    injector.mockCommand('file.save', mockSave);

    const provider = injector.get(UntitledSchemeDocumentProvider);

    const untitledURI = URI.from({
      scheme: Schemes.untitled,
      authority: 'test',
      path: '/test.js',
      query: 'name=test.js',
    });

    expect(provider.isReadonly(untitledURI)).toBeFalsy();

    expect(provider.isAlwaysDirty(untitledURI)).toBeTruthy();

    expect(provider.disposeEvenDirty(untitledURI)).toBeTruthy();

    expect(provider.handlesScheme(Schemes.untitled)).toBeTruthy();
    expect(provider.handlesScheme(Schemes.file)).toBeFalsy();

    expect(await provider.provideEditorDocumentModelContent(untitledURI)).toBe('');

    expect(await provider.closeAutoSave(untitledURI)).toBe(true);

    await provider.saveDocumentModel(untitledURI, 'test document', '', [], 'utf8');

    expect(mockSave).toHaveBeenCalled();
  });

  it('diff resource tests', async () => {
    injector.mockService(LabelService, {
      getIcon: jest.fn((uri) => uri.toString()),
    });

    injector.mockService(IFileServiceClient, {
      getCurrentUserHome: jest.fn(() => new URI('file:///home')),
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
    expect(resourceService.getResource).toHaveBeenCalled();
    expect(resourceService.shouldCloseResource).toHaveBeenCalled();

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
          readOnly: false,
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
  });

  afterAll(async () => {
    await injector.disposeAll();
  });
});
