import { IApplicationService, IJSONSchemaRegistry, ISchemaStore, localize } from '@opensumi/ide-core-browser';
import { DefaultUriLabelProvider } from '@opensumi/ide-core-browser/lib/services';
import { CommonServerPath } from '@opensumi/ide-core-common';
import {
  BinaryBuffer,
  Disposable,
  OperatingSystem,
  SaveTaskErrorCause,
  SaveTaskResponseState,
  URI,
} from '@opensumi/ide-core-common';
import {
  HashCalculateServiceImpl,
  IHashCalculateService,
} from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { EditorPreferences } from '@opensumi/ide-editor/lib/browser';
import { FileSystemResourceProvider } from '@opensumi/ide-editor/lib/browser/fs-resource/fs-resource';
import { FileSchemeDocNodeServicePath } from '@opensumi/ide-file-scheme';
import {
  FileSchemeDocumentProvider,
  VscodeSchemeDocumentProvider,
} from '@opensumi/ide-file-scheme/lib/browser/file-doc';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { MockFileServiceClient } from '@opensumi/ide-file-service/__mocks__/file-service-client';
import { IDialogService } from '@opensumi/ide-overlay';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileSchemeModule } from '../../src/browser';

describe('file scheme tests', () => {
  const injector = createBrowserInjector([FileSchemeModule]);
  injector.overrideProviders(
    {
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    },
    {
      token: IHashCalculateService,
      useClass: HashCalculateServiceImpl,
    },
    {
      token: IEditorDocumentModelService,
      useValue: {},
    },
    {
      token: IDialogService,
      useValue: {},
    },
    {
      token: EditorPreferences,
      useValue: {
        'editor.readonlyFiles': ['.readonly.js'],
      },
      override: true,
    },
    {
      token: IJSONSchemaRegistry,
      useValue: {},
    },
    {
      token: ISchemaStore,
      useValue: {},
    },
    {
      token: CommonServerPath,
      useValue: {
        getBackendOS: jest.fn(() => OperatingSystem.Linux),
      },
    },
  );

  const hashCalculateService: IHashCalculateService = injector.get(IHashCalculateService);

  let dialogResult: string | undefined;
  injector.mock(IDialogService, 'open', async () => dialogResult);
  injector.mock(DefaultUriLabelProvider, 'getIcon', () => '');

  injector.mock(IFileServiceClient, 'onFilesChanged', () => new Disposable());
  injector.mock(IEditorDocumentModelService, 'getModelReference', () => ({
    instance: {
      dirty: true,
      revert: () => null,
      save: () => true,
    },
    dispose: () => null,
  }));
  injector.mock(IEditorDocumentModelService, 'getModelDescription', () => ({
    dirty: true,
  }));

  injector.addProviders({
    token: FileSchemeDocNodeServicePath,
    useValue: {},
  });

  beforeAll(async () => {
    await hashCalculateService.initialize();
    const applicationService = injector.get(IApplicationService);
    await applicationService.initializeData();
  });

  const saveByContent = jest.fn();
  injector.mock(FileSchemeDocNodeServicePath, '$saveByContent', () => saveByContent());

  it('resource service test', async () => {
    const resourceProvider = injector.get(FileSystemResourceProvider);
    await resourceProvider.init();
    const resource = await resourceProvider.provideResource(new URI('file:///test.ts'));

    expect(resource.name).toBe('test.ts');
    expect(resource.uri.toString()).toBe('file:///test.ts');

    const resource2 = await resourceProvider.provideResource(new URI('file:///test1/test.ts'));

    const subname = await resourceProvider.provideResourceSubname(resource, [resource, resource2]);
    expect(subname).toBe('.../');
    expect(await resourceProvider.provideResourceSubname(resource, [resource])).toBeNull();

    dialogResult = localize('file.prompt.dontSave', "Don't Save");
    expect(await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeTruthy();

    dialogResult = localize('file.prompt.save', 'Save');
    expect(await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeTruthy();

    dialogResult = localize('file.prompt.cancel', 'Cancel');
    expect(await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeFalsy();
  });

  it('doc service test', async () => {
    const docContentPrefix = 'this is docContent for ';
    const documentProvider = injector.get(FileSchemeDocumentProvider);

    injector.mock(FileSchemeDocNodeServicePath, '$getMd5', (uriString) =>
      hashCalculateService.calculate(docContentPrefix + uriString),
    );

    const saveByContent = jest.fn();
    injector.mock(FileSchemeDocNodeServicePath, '$saveByContent', () => saveByContent());

    const saveByChanges = jest.fn();
    injector.mock(FileSchemeDocNodeServicePath, '$saveByChanges', () => saveByChanges());

    injector.mock(IFileServiceClient, 'resolveContent', (uriString) => ({ content: docContentPrefix + uriString }));

    injector.mock(IFileServiceClient, 'readFile', (uriString) => ({
      content: BinaryBuffer.fromString(docContentPrefix + uriString),
    }));

    await documentProvider.saveDocumentModel(
      new URI('file:///test.ts'),
      'this is modified content',
      'docContent',
      [],
      'utf8',
    );
    expect(saveByContent).toHaveBeenCalledTimes(1);
    expect(saveByChanges).toHaveBeenCalledTimes(0);

    expect(await documentProvider.provideEditorDocumentModelContent(new URI('file:///test.ts'), 'utf8')).toBe(
      docContentPrefix + 'file:///test.ts',
    );
    expect(await documentProvider.provideEditorDocumentModelContentMd5(new URI('file:///test.ts'), 'utf8')).toBe(
      hashCalculateService.calculate(docContentPrefix + 'file:///test.ts'),
    );

    expect(await documentProvider.isReadonly(new URI('file:///a/b/c.readonly.js'))).toBeTruthy();
    expect(await documentProvider.isReadonly(new URI('file:///a/b/c.n.js'))).toBeFalsy();

    const vscodeDoc = injector.get(VscodeSchemeDocumentProvider);

    expect(vscodeDoc.handlesScheme('vscode')).toBeTruthy();
    expect(vscodeDoc.isReadonly(new URI('vscode:///anyUri'))).toBeTruthy();
    injector.mock(
      IJSONSchemaRegistry,
      'getSchemaContributions',
      jest.fn(() => ({
        schemas: {
          [new URI('vscode:///testuri').toString()]: {
            testSchemaKey: 'string',
          },
        },
      })),
    );

    expect(await vscodeDoc.provideEditorDocumentModelContent(new URI('vscode:///testuri'), 'utf-8')).toBe(
      JSON.stringify({
        testSchemaKey: 'string',
      }),
    );
  });

  it('should fallback to saveByContent when saveByChange returns USE_BY_CONTENT', async () => {
    const documentProvider = injector.get(FileSchemeDocumentProvider);

    const saveByContent = jest.fn(() => ({ state: SaveTaskResponseState.SUCCESS }));
    injector.mock(FileSchemeDocNodeServicePath, '$saveByContent', saveByContent);

    const saveByChange = jest.fn(() => ({
      state: SaveTaskResponseState.ERROR,
      errorMessage: SaveTaskErrorCause.USE_BY_CONTENT,
    }));
    injector.mock(FileSchemeDocNodeServicePath, '$saveByChange', saveByChange);

    // Content exceeding FILE_SAVE_BY_CHANGE_THRESHOLD (100KB) to trigger saveByChange path
    const largeContent = 'x'.repeat(100001);

    const result = await documentProvider.saveDocumentModel(
      new URI('file:///test-fallback.ts'),
      largeContent,
      'baseContent',
      [],
      'utf8',
    );

    expect(saveByChange).toHaveBeenCalledTimes(1);
    expect(saveByContent).toHaveBeenCalledTimes(1);
    expect(result.state).toBe(SaveTaskResponseState.SUCCESS);
  });
});
