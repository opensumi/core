import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { EditorCollectionService, WorkbenchEditorService, ResourceService, ILanguageService, IResourceProvider, EditorGroupSplitAction } from '@ali/ide-editor/lib/common';
import { EditorCollectionServiceImpl } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { WorkbenchEditorServiceImpl, EditorGroup } from '@ali/ide-editor/lib/browser/workbench-editor.service';
import { ResourceServiceImpl } from '@ali/ide-editor/lib/browser/resource.service';
import { EditorComponentRegistry, IEditorDecorationCollectionService, IEditorDocumentModelContentRegistry, IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { EditorComponentRegistryImpl } from '@ali/ide-editor/lib/browser/component';
import { EditorDecorationCollectionService } from '@ali/ide-editor/lib/browser/editor.decoration.service';
import { EditorDocumentModelContentRegistryImpl, EditorDocumentModelServiceImpl } from '@ali/ide-editor/lib/browser/doc-model/main';
import { LanguageService } from '@ali/ide-editor/lib/browser/language/language.service';
import { MonacoService } from '@ali/ide-monaco';
import { MockedMonacoService } from '@ali/ide-monaco/lib/__mocks__/monaco.service.mock';
import { URI, Disposable } from '@ali/ide-core-common';
import { TestResourceProvider, TestResourceResolver, TestEditorDocumentProvider, TestResourceResolver2, TestResourceComponent } from './test-providers';
import { useMockStorage } from '@ali/ide-core-browser/lib/mocks/storage';
import { IWorkspaceService } from '@ali/ide-workspace';
import { reaction } from 'mobx';
import { CorePreferences } from '@ali/ide-core-browser';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';

const injector = createBrowserInjector([]);

injector.addProviders(...[
  {
    token: EditorCollectionService,
    useClass: EditorCollectionServiceImpl,
  },
  {
    token: WorkbenchEditorService,
    useClass: WorkbenchEditorServiceImpl,
  },
  {
    token: ResourceService,
    useClass: ResourceServiceImpl,
  },
  {
    token: EditorComponentRegistry,
    useClass: EditorComponentRegistryImpl,
  },
  {
    token: IEditorDecorationCollectionService,
    useClass: EditorDecorationCollectionService,
  },
  {
    token: IEditorDocumentModelContentRegistry,
    useClass: EditorDocumentModelContentRegistryImpl,
  },
  {
    token: IEditorDocumentModelService,
    useClass: EditorDocumentModelServiceImpl,
  },
  {
    token: ILanguageService,
    useClass: LanguageService,
  },
  {
    token: MonacoService,
    useClass: MockedMonacoService,
  },
  {
    token: IWorkspaceService,
    useClass: MockWorkspaceService,
  },
]);
useMockStorage(injector);
injector.overrideProviders({
  token: CorePreferences,
  useValue: {
    'editor.previewMode': true,
  },
});

describe('editor collection service tests', () => {

  it('should be able to create and dispose editors', async (done) => {
    const editorService: EditorCollectionService = injector.get(EditorCollectionService);
    const editor = await editorService.createCodeEditor(document.createElement('div'));
    expect(editor).toBeDefined();

    expect(editorService.listEditors().length).toBe(1);

    const diffEditor = await editorService.createDiffEditor(document.createElement('div'));
    expect(diffEditor).toBeDefined();

    expect(editorService.listEditors().length).toBe(3);
    expect(editorService.listDiffEditors().length).toBe(1);

    editor.dispose();
    diffEditor.dispose();

    expect(editorService.listEditors().length).toBe(0);
    expect(editorService.listDiffEditors().length).toBe(0);

    done();
  });

});

describe('workbench editor service tests', () => {

  // prepare
  const editorService: WorkbenchEditorService = injector.get(WorkbenchEditorService);

  const resourceService: ResourceService = injector.get(ResourceService);
  const editorComponentRegistry: EditorComponentRegistry = injector.get(EditorComponentRegistry);
  const editorDocModelRegistry: IEditorDocumentModelContentRegistry = injector.get(IEditorDocumentModelContentRegistry);
  const editorDocModelService: IEditorDocumentModelService = injector.get(IEditorDocumentModelService);

  const disposer = new Disposable();
  beforeAll(() => {
    injector.mockCommand('explorer.location');
    disposer.addDispose(resourceService.registerResourceProvider(TestResourceProvider));
    disposer.addDispose(editorComponentRegistry.registerEditorComponent(TestResourceComponent));
    disposer.addDispose(editorComponentRegistry.registerEditorComponentResolver('test', TestResourceResolver));
    disposer.addDispose(editorComponentRegistry.registerEditorComponentResolver('test', TestResourceResolver2));
    disposer.addDispose(editorDocModelRegistry.registerEditorDocumentModelContentProvider(TestEditorDocumentProvider));
    (editorService as any).contributionsReady.resolve();
    reaction(() => {
      return editorService.editorGroups.length;
    }, () => {
      editorService.editorGroups.forEach((g) => {
        if (!g.codeEditor) {
          (g as EditorGroup).createEditor(document.createElement('div'));
          (g as EditorGroup).createDiffEditor(document.createElement('div'));
        }
      });
    });
  });

  it('should be able to open uri', async (done) => {

    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri);
    expect(editorService.currentResource).toBeDefined();
    expect(editorService.currentResource!.uri.toString()).toBe(testCodeUri.toString());

    await editorService.closeAll();
    done();
  });

  it('should be able to open component ', async (done) => {

    const testComponentUri = new URI('test://component');
    await editorService.open(testComponentUri);
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe('component');

    await editorService.closeAll();

    await editorService.open(testComponentUri, { forceOpenType: { type: 'code' } });
    expect(editorService.editorGroups[0].currentOpenType).toBeDefined();
    expect(editorService.editorGroups[0].currentOpenType!.type).toBe('code');

    done();
  });

  it('should be able to split', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri);
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Right });
    await editorService.open(testCodeUri, { split: EditorGroupSplitAction.Bottom });
    expect(editorService.editorGroups.length).toBe(3);

    await editorService.closeAll();
    done();
  });

  it('preview mode should work', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: true });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: true });
    expect(editorService.editorGroups[0].resources.length).toBe(1);

    await editorService.closeAll();
    done();
  });

  it('pined mode should work', async (done) => {
    const testCodeUri = new URI('test://testUri1');
    await editorService.open(testCodeUri, { preview: false });
    const testCodeUri2 = new URI('test://testUri2');
    await editorService.open(testCodeUri2, { preview: false });
    expect(editorService.editorGroups[0].resources.length).toBe(2);

    await editorService.closeAll();
    done();
  });

  afterAll(() => {
    disposer.dispose();
  });

});
