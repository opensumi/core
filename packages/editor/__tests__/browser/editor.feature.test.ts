import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ILogger, Disposable, URI, Emitter } from '@ali/ide-core-common';
import { EditorFeatureRegistryImpl } from '@ali/ide-editor/lib/browser/feature';
import { IEditor } from '@ali/ide-editor';
import { IEditorFeatureRegistry, IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { EditorTopPaddingContribution } from '@ali/ide-editor/lib/browser/view/topPadding';
import { QuickPickService, PreferenceService } from '@ali/ide-core-browser';
import { FormattingSelector } from '@ali/ide-editor/lib/browser/format/formatterSelect';

describe('editor status bar item test', () => {

  const injector = createBrowserInjector([]);

  beforeAll(() => {
    injector.mockService(ILogger);
    injector.addProviders({
      token: IEditorFeatureRegistry,
      useClass: EditorFeatureRegistryImpl,
    });
  });

  it('editor feature test basic', () => {
    const service: EditorFeatureRegistryImpl = injector.get(IEditorFeatureRegistry);
    const contributionDisposer = new Disposable();
    const contribution = {
      contribute: jest.fn((editor: IEditor) => {
        return contributionDisposer;
      }),
    };
    const listener = jest.fn();
    service.onDidRegisterFeature(listener);

    const disposer = service.registerEditorFeatureContribution(contribution);

    expect(listener).toBeCalledWith(contribution);

    service.runContributions({
      onDispose: jest.fn(),
    } as any);

    expect(contribution.contribute).toBeCalledTimes(1);

    disposer.dispose();
  });

  it('top padding feature test', () => {
    const service: EditorFeatureRegistryImpl = injector.get(IEditorFeatureRegistry);
    service.registerEditorFeatureContribution(new EditorTopPaddingContribution());
    const accessor = {
      addZone: jest.fn(),
    };
    const _onDidChangeModel = new Emitter<void>();
    const editor = {
      monacoEditor: {
        onDidChangeModel: _onDidChangeModel.event,
        changeViewZones: jest.fn((fn) => {
          fn(accessor);
        }),
      },
      onDispose: jest.fn(),
    };
    service.runContributions(editor as any);
    _onDidChangeModel.fire();
    expect(editor.monacoEditor.changeViewZones).toBeCalled();
    expect(accessor.addZone).toBeCalled();
  });

  it('formatter select test', async ( done ) => {
    injector.mockService(QuickPickService, {
      show: (strings: string[]) => {
        return  strings[0];
      },
    });
    const config = {};
    injector.mockService(PreferenceService, {
      get: jest.fn((key) => {
        return config[key];
      }),
      set: jest.fn((key, value) => {
        config[key] = value;
      }),
    });
    injector.mockService(IEditorDocumentModelService, {
      getModelReference: () => {
        return {
          instance: {
            languageId: 'javascript',
          },
          dispose: jest.fn(),
        };
      },
    });

    const selector: FormattingSelector = injector.get(FormattingSelector);

    await selector.select([{
      displayName: 'testFormatter',
      provideDocumentFormattingEdits: jest.fn(),
    }, {
      displayName: 'testFormatter2',
      provideDocumentFormattingEdits: jest.fn(),
    }], {
      uri: new URI('file:///test/test.js').codeUri,
    } as any);

    expect(config['editor.preferredFormatter']['javascript']).toBe('testFormatter');

    done();
  });

  afterAll(() => {
    injector.disposeAll();
  });

});
