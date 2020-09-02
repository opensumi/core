import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedMonacoService } from '@ali/ide-monaco/lib/__mocks__/monaco.service.mock';
import { MonacoService, PreferenceService, PreferenceChange, Emitter, PreferenceScope, URI, PreferenceChanges } from '@ali/ide-core-browser';
import { BrowserCodeEditor, BaseMonacoEditorWrapper } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { EditorCollectionService, EditorType } from '@ali/ide-editor';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { Injectable } from '@ali/common-di';
import { IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';

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

  it('options level test', () => {
    const emitter = new Emitter<PreferenceChange>();
    const emitter1 = new Emitter<PreferenceChanges>();
    const prefs = {
      'editor.forceReadOnly': true,
      'editor.fontSize': 20,
    };
    const setPref = (key, value) => {
      prefs[key] = value;
      emitter.fire({
        oldValue: undefined,
        newValue: value,
        preferenceName: key,
        scope: PreferenceScope.User,
        affects: () => true,
      });
      emitter1.fire({
        [key]: {
          oldValue: undefined,
          newValue: value,
          preferenceName: key,
          scope: PreferenceScope.User,
          affects: () => true,
        },
      });
    };
    const mockPreferenceService: Partial<PreferenceService> =  {
      onPreferenceChanged: emitter.event,
      onPreferencesChanged:  emitter1.event,
      get: (key) => {
        return prefs[key];
      },
    };
    const injector = createBrowserInjector([]);
    injector.addProviders({
      token: PreferenceService,
      useValue: mockPreferenceService,
      override: true,
    });
    injector.mockService(IEditorFeatureRegistry);

    @Injectable({multiple: true})
    class SimpleTestEditor extends BaseMonacoEditorWrapper {

      get currentDocumentModel() {
        return (this.monacoEditor.getModel() ? {
          uri: new URI(this.monacoEditor.getModel()!.uri.toString()),
        } : null) as any;
      }
    }

    const options: Record<string, any> = {};
    const modelOptions: Record<string, any> = {};
    const onDidModelChange = new Emitter<any>();
    let _uri: URI | undefined;
    const monacoEditor = mockService<monaco.editor.ICodeEditor>({
      updateOptions: (v) => {
        Object.assign(options, v);
      },
      getModel: () => {
        return (_uri ? {
          uri: _uri,
          updateOptions: (v) => {
            Object.assign(modelOptions, v);
          },
        } : undefined )as any;
      },
      onDidChangeModel: onDidModelChange.event,
      onDidChangeModelLanguage: new Emitter<any>().event,
    });

    function open(uri: URI) {
      _uri = uri;
      onDidModelChange.fire({});
    }

    const testEditor = injector.get(SimpleTestEditor, [monacoEditor, EditorType.CODE]);

    open(new URI('file:///test/test.js'));

    expect(options['fontSize']).toBe(20);

    testEditor.updateOptions({fontSize: 40});

    expect(options['fontSize']).toBe(40);

    open(new URI('file:///test/test2.js'));

    // 切换后仍然有这个option
    expect(options['fontSize']).toBe(40);

    testEditor.updateOptions({fontSize: undefined});

    expect(options['fontSize']).toBe(20);

    setPref('editor.fontSize', 35);

    expect(options['fontSize']).toBe(35);
  });

});
