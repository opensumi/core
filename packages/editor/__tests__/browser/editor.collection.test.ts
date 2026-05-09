import { Injectable } from '@opensumi/di';
import { Emitter, MonacoService, URI } from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { EditorCollectionService, EditorType } from '@opensumi/ide-editor';
import { IEditorDecorationCollectionService, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { BrowserCodeEditor } from '@opensumi/ide-editor/lib/browser/editor-collection.service';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import * as monaco from '@opensumi/ide-monaco';
import { MockedMonacoService } from '@opensumi/ide-monaco/__mocks__/monaco.service.mock';
import { monaco as monacoAPI } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import {
  ConfigurationTarget,
  IConfigurationChangeEvent,
  IConfigurationOverrides,
  IConfigurationService,
} from '@opensumi/monaco-editor-core/esm/vs/platform/configuration/common/configuration';

import { BaseMonacoEditorWrapper } from '../../src/browser/base-editor-wrapper';

describe('editor collection service test', () => {
  let injector: MockInjector;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    injector.addProviders(
      {
        token: MonacoService,
        useClass: MockedMonacoService,
      },
      {
        token: IEditorDecorationCollectionService,
        useClass: EditorDecorationCollectionService,
      },
    );
  });

  afterAll(async () => {
    await injector.disposeAll();
  });

  it('code editor test', () => {
    const emitter = new Emitter<IConfigurationChangeEvent>();
    const prefs = {
      'editor.fontSize': 20,
      'editor.forceReadonly': false,
    };
    injector.mockService(EditorCollectionService);
    const mockConfigurationService: Partial<IConfigurationService> = {
      onDidChangeConfiguration: emitter.event,
      getValue: ((section: string, overrides?: IConfigurationOverrides) => prefs[section]) as any,
    };
    injector.addProviders({
      token: IConfigurationService,
      useValue: mockConfigurationService,
      override: true,
    });
    const mockEditor = monacoAPI.editor.create(document.createElement('div'));
    const codeEditor = injector.get(BrowserCodeEditor, [mockEditor]);
    const updateOptions = jest.spyOn(codeEditor, 'updateOptions');
    const getSelections = jest.spyOn(codeEditor, 'getSelections');
    const setSelections = jest.fn(() => {});
    mockEditor.setSelections = setSelections;

    codeEditor.updateOptions({}, {});
    expect(updateOptions).toHaveBeenCalled();

    expect(codeEditor.getType()).toBe(EditorType.CODE);

    codeEditor.getSelections();
    expect(getSelections).toHaveBeenCalled();

    codeEditor.setSelections([]);
    expect(setSelections).toHaveBeenCalled();
  });

  it('options level test', () => {
    const emitter = new Emitter<IConfigurationChangeEvent>();
    const prefs = {
      'editor.fontSize': 20,
      'editor.forceReadonly': false,
    };
    const setPref = (key, value) => {
      prefs[key] = value;
      emitter.fire({
        source: ConfigurationTarget.USER,
        affectedKeys: new Set([key]),
        change: {
          keys: [key],
          overrides: [],
        },
        affectsConfiguration: (() => {}) as any,
      });
    };
    const mockConfigurationService: Partial<IConfigurationService> = {
      onDidChangeConfiguration: emitter.event,
      getValue: ((section: string, overrides?: IConfigurationOverrides) => prefs[section]) as any,
    };
    injector.addProviders({
      token: IConfigurationService,
      useValue: mockConfigurationService,
      override: true,
    });
    injector.mockService(IEditorFeatureRegistry);

    @Injectable({ multiple: true })
    class SimpleTestEditor extends BaseMonacoEditorWrapper {
      get currentDocumentModel() {
        if (!this.monacoEditor.getModel()) {
          return null as any;
        }
        const uriString = this.monacoEditor.getModel()!.uri.toString();
        return {
          uri: new URI(uriString),
          readonly: uriString.endsWith('test2.js'),
          isLargeFile: uriString.endsWith('large.js'),
        } as any;
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
      getModel: () =>
        (_uri
          ? {
              uri: _uri,
              updateOptions: (v) => {
                Object.assign(modelOptions, v);
              },
            }
          : undefined) as any,
      onDidChangeModel: onDidModelChange.event,
      onDidChangeModelLanguage: new Emitter<any>().event,
      onDidDispose: new Emitter<any>().event,
    });

    function open(uri: URI) {
      _uri = uri;
      onDidModelChange.fire({});
    }

    const testEditor = injector.get(SimpleTestEditor, [monacoEditor, EditorType.CODE]);

    open(new URI('file:///test/test.js'));

    setPref('editor.fontSize', 20);
    setPref('editor.readOnly', false);

    expect(options['fontSize']).toBe(20);

    testEditor.updateOptions({ fontSize: 40 });

    expect(options['fontSize']).toBe(40);
    expect(options['readOnly']).toBeFalsy();

    open(new URI('file:///test/test2.js'));

    // 切换后仍然有这个option
    expect(options['fontSize']).toBe(40);
    setPref('editor.readOnly', true);
    expect(options['readOnly']).toBeTruthy();

    testEditor.updateOptions({ fontSize: undefined });

    expect(options['fontSize']).toBe(20);

    setPref('editor.fontSize', 35);

    expect(options['fontSize']).toBe(35);

    open(new URI('file:///test/test3.js'));
    setPref('editor.readOnly', false);
    expect(options['readOnly']).toBeFalsy();

    setPref('editor.forceReadOnly', true);
    expect(options['readOnly']).toBeTruthy();

    open(new URI('file:///test/large.js'));
    testEditor.updateOptions({});
    expect(options['folding']).toBeFalsy();
    expect(options['minimap']).toEqual({ enabled: false });
    expect(options['wordWrap']).toBe('off');
  });
});
