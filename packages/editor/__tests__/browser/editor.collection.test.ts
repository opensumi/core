import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedMonacoService } from '@ali/ide-monaco/lib/__mocks__/monaco.service.mock';
import { MonacoService } from '@ali/ide-core-browser';
import { BrowserCodeEditor } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { EditorCollectionService, EditorType } from '@ali/ide-editor';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';

describe('editor collection service test', () => {

  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: MonacoService,
    useClass: MockedMonacoService,
  });

  it('code editor test', () => {
    injector.mockService(EditorCollectionService);
    const monaco = (global as any).monaco || createMockedMonaco();
    const mockEditor = monaco.editor.create(document.createElement('div'));
    const codeEditor = injector.get(BrowserCodeEditor, [mockEditor]);
    codeEditor.updateOptions({}, {});
    expect(mockEditor.updateOptions).toBeCalled();

    expect(codeEditor.getType()).toBe(EditorType.CODE);

    codeEditor.getSelections();
    expect(mockEditor.getSelections).toBeCalled();

    codeEditor.setSelections([]);
    expect(mockEditor.setSelections).toBeCalled();

  });

  afterAll(() => {
    injector.disposeAll();
    (global as any).monaco = undefined;
  });

});
