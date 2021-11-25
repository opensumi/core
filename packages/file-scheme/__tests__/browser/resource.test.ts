import { IDialogService } from '@opensumi/ide-overlay';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { DefaultUriLabelProvider } from '@opensumi/ide-core-browser/lib/services';
import { Disposable, URI, localize, IJSONSchemaRegistry, ISchemaStore, OS, IApplicationService } from '@opensumi/ide-core-browser';
import { CommonServerPath } from '@opensumi/ide-core-common';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks/file-service-client';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import { FileSchemeDocNodeServicePath } from '@opensumi/ide-file-scheme';
import { FileSchemeDocumentProvider, VscodeSchemeDocumentProvider } from '@opensumi/ide-file-scheme/lib/browser/file-doc';
import { FileSchemeModule } from '../../src/browser';
import { EditorPreferences } from '@opensumi/ide-editor/lib/browser';
import { FileSystemResourceProvider } from '@opensumi/ide-editor/lib/browser/fs-resource/fs-resource';
import { BinaryBuffer } from '@opensumi/ide-core-common/lib/utils/buffer';
import { HashCalculateServiceImpl, IHashCalculateService } from '@opensumi/ide-core-common/lib/hash-calculate/hash-calculate';

describe('file scheme tests', () => {

  const injector = createBrowserInjector([FileSchemeModule]);
  injector.overrideProviders({
    token: IFileServiceClient,
    useClass: MockFileServiceClient,
  },
  {
    token: IHashCalculateService,
    useClass: HashCalculateServiceImpl,
  },
  {
    token: IDialogService,
    useValue: {},
  }, {
    token: IEditorDocumentModelService,
    useValue: {},
  }, {
    token: EditorPreferences,
    useValue: {
      'editor.readonlyFiles': ['.readonly.js'],
    },
    override: true,
  }, {
    token: IJSONSchemaRegistry,
    useValue: {},
  }, {
    token: ISchemaStore,
    useValue: {},
  }, {
    token: CommonServerPath,
    useValue: {
      getBackendOS: jest.fn(() => OS.Type.Linux),
    },
  });

  const hashCalculateService: IHashCalculateService = injector.get(IHashCalculateService);

  let dialogResult: string | undefined;
  injector.mock(IDialogService, 'open', async () => {
    return dialogResult;
  });
  injector.mock(DefaultUriLabelProvider, 'getIcon',  () => {
    return '';
  });

  injector.mock(IFileServiceClient, 'onFilesChanged', () => {
    return new Disposable();
  });
  injector.mock(IEditorDocumentModelService, 'getModelReference', () => {
    return {
      instance: {
        dirty: true,
        revert: () => null,
        save: () => true,
      },
      dispose: () => {
        return null;
      },
    };
  });

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
  injector.mock(FileSchemeDocNodeServicePath, '$saveByContent', () => {
    return saveByContent();
  });

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

    dialogResult = localize('file.prompt.dontSave', '不保存');
    expect (await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeTruthy();

    dialogResult = localize('file.prompt.save', '保存');
    expect (await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeTruthy();

    dialogResult = localize('file.prompt.cancel', '取消');
    expect (await resourceProvider.shouldCloseResource(resource, [[resource]])).toBeFalsy();
  });

  it('doc service test', async (done) => {

    const docContentPrefix = 'this is docContent for ';
    const documentProvider = injector.get(FileSchemeDocumentProvider);

    injector.mock(FileSchemeDocNodeServicePath, '$getMd5', (uriString) => {
      return hashCalculateService.calculate(docContentPrefix + uriString);
    });

    const saveByContent = jest.fn();
    injector.mock(FileSchemeDocNodeServicePath, '$saveByContent', () => {
      return saveByContent();
    });

    const saveByChanges = jest.fn();
    injector.mock(FileSchemeDocNodeServicePath, '$saveByChanges', () => {
      return saveByChanges();
    });

    injector.mock(IFileServiceClient, 'resolveContent', (uriString) => {
      return { content: docContentPrefix + uriString };
    });

    injector.mock(IFileServiceClient, 'readFile', (uriString) => {
      return { content: BinaryBuffer.fromString(docContentPrefix + uriString) };
    });

    await documentProvider.saveDocumentModel(new URI('file:///test.ts'), 'this is modified content', 'docContent', [], 'utf8');
    expect(saveByContent).toBeCalledTimes(1);
    expect(saveByChanges).toBeCalledTimes(0);

    expect(await documentProvider.provideEditorDocumentModelContent(new URI('file:///test.ts'), 'utf8')).toBe(docContentPrefix + 'file:///test.ts');
    expect(await documentProvider.provideEditorDocumentModelContentMd5(new URI('file:///test.ts'), 'utf8')).toBe(hashCalculateService.calculate(docContentPrefix + 'file:///test.ts'));

    expect(await documentProvider.isReadonly(new URI('file:///a/b/c.readonly.js'))).toBeTruthy();
    expect(await documentProvider.isReadonly(new URI('file:///a/b/c.n.js'))).toBeFalsy();

    const vscodeDoc = injector.get(VscodeSchemeDocumentProvider);

    expect(vscodeDoc.handlesScheme('vscode')).toBeTruthy();
    expect(vscodeDoc.isReadonly(new URI('vscode:///anyUri'))).toBeTruthy();
    injector.mock(IJSONSchemaRegistry, 'getSchemaContributions', jest.fn(() => {
      return {
        schemas: {
          [new URI('vscode:///testuri').toString()] : {
            testSchemaKey: 'string',
          },
        },
      };
    }));

    expect(await vscodeDoc.provideEditorDocumentModelContent(new URI('vscode:///testuri'), 'utf-8')).toBe(JSON.stringify({
      testSchemaKey: 'string',
    }));

    done();
  });

});
