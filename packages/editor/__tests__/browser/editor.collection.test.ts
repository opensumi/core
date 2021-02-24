import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedMonacoService } from '@ali/ide-monaco/lib/__mocks__/monaco.service.mock';
import { MonacoService, PreferenceService, PreferenceChange, Emitter, PreferenceScope, URI, PreferenceChanges } from '@ali/ide-core-browser';
import { BrowserCodeEditor, BaseMonacoEditorWrapper } from '@ali/ide-editor/lib/browser/editor-collection.service';
import { EditorCollectionService, EditorType } from '@ali/ide-editor';
import { mockService } from '../../../../tools/dev-tool/src/mock-injector';
import { Injectable } from '@ali/common-di';
import { IEditorDecorationCollectionService, IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';
import { EditorDecorationCollectionService } from '@ali/ide-editor/lib/browser/editor.decoration.service';

describe('editor collection service test', () => {

  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: MonacoService,
    useClass: MockedMonacoService,
  }, {
    token: IEditorDecorationCollectionService,
    useClass: EditorDecorationCollectionService,
  });

  it('code editor test', () => {
    injector.mockService(EditorCollectionService);
    const mockEditor = monaco.editor.create(document.createElement('div'));
    const codeEditor = injector.get(BrowserCodeEditor, [mockEditor]);
    const updateOptions = jest.spyOn(codeEditor, 'updateOptions');
    const getSelections = jest.spyOn(codeEditor, 'getSelections');
    const setSelections = jest.fn(() => {});
    mockEditor.setSelections = setSelections;

    codeEditor.updateOptions({}, {});
    expect(updateOptions).toBeCalled();

    expect(codeEditor.getType()).toBe(EditorType.CODE);

    codeEditor.getSelections();
    expect(getSelections).toBeCalled();

    codeEditor.setSelections([]);
    expect(setSelections).toBeCalled();

  });

  afterAll(() => {
    injector.disposeAll();
  });

  it('options level test', () => {
    const emitter = new Emitter<PreferenceChange>();
    const emitter1 = new Emitter<PreferenceChanges>();
    const prefs = {
      'editor.fontSize': 20,
      'editor.forceReadonly': false,
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
          readonly: this.monacoEditor.getModel()!.uri.toString().endsWith('test2.js'),
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
    expect(options['readOnly']).toBeFalsy();

    open(new URI('file:///test/test2.js'));

    // 切换后仍然有这个option
    expect(options['fontSize']).toBe(40);

    expect(options['readOnly']).toBeTruthy();

    testEditor.updateOptions({fontSize: undefined});

    expect(options['fontSize']).toBe(20);

    setPref('editor.fontSize', 35);

    expect(options['fontSize']).toBe(35);

    open(new URI('file:///test/test3.js'));
    expect(options['readOnly']).toBeFalsy();

    setPref('editor.forceReadOnly', true);
    expect(options['readOnly']).toBeTruthy();
  });

});
