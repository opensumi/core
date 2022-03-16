import { URI, Emitter, IEventBus, Disposable } from '@opensumi/ide-core-browser';
import {
  IEditorDecorationCollectionService,
  EditorDecorationChangeEvent,
  EditorDecorationTypeRemovedEvent,
} from '@opensumi/ide-editor/lib/browser';
import { EditorDecorationCollectionService } from '@opensumi/ide-editor/lib/browser/editor.decoration.service';
import { createMockedMonaco } from '@opensumi/ide-monaco/__mocks__/monaco';
import { IThemeService } from '@opensumi/ide-theme';
import { ICSSStyleService } from '@opensumi/ide-theme/lib/common/style';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MonacoEditorDecorationApplier } from '../../src/browser/decoration-applier';

describe('editor decoration service test', () => {
  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: IEditorDecorationCollectionService,
    useClass: EditorDecorationCollectionService,
  });

  const decorationService: IEditorDecorationCollectionService = injector.get(IEditorDecorationCollectionService);
  const decorationServiceImpl = decorationService as EditorDecorationCollectionService;

  const _decorationChange = new Emitter<URI>();
  let className = 'testDecoration';
  const provider = {
    schemes: ['file'],
    key: 'test',
    provideEditorDecoration: (uri) => {
      if (uri.toString().endsWith('.js')) {
        return [
          {
            range: {
              startLineNumber: 1,
              endColumn: 1,
              startColumn: 1,
              endLineNumber: 1,
            },
            options: {
              description: 'test',
              className,
              isWholeLine: true,
            },
          },
        ];
      }
    },
    onDidDecorationChange: _decorationChange.event,
  };

  const mockedMonaco = createMockedMonaco();

  it('should be able to register decoration providers', () => {
    const disposer = decorationService.registerDecorationProvider(provider);

    expect(decorationServiceImpl.decorationProviders.get(provider.key)).toEqual(provider);

    disposer.dispose();

    expect(decorationServiceImpl.decorationProviders.get(provider.key)).toBeUndefined();
  });

  it('should be able to correctly resolve decoration', async (done) => {
    const disposer = decorationService.registerDecorationProvider(provider);
    const result = await decorationService.getDecorationFromProvider(new URI('file://test/test.js'));
    expect(result[provider.key]).not.toBeUndefined();
    expect(result[provider.key][0]).not.toBeUndefined();

    expect(result[provider.key][0].options.className).toEqual(className);

    const anotherResult = await decorationService.getDecorationFromProvider(new URI('file://test/test.ts'));
    expect(anotherResult[provider.key]).toBeUndefined();
    disposer.dispose();
    done();
  });

  it('should be able to listen to event', async (done) => {
    const disposer = decorationService.registerDecorationProvider(provider);
    const uri = new URI('file://test/test.js');
    (injector.get(IEventBus) as IEventBus).on(EditorDecorationChangeEvent, async (e) => {
      if (e.payload.uri.isEqual(uri)) {
        const result = await decorationService.getDecorationFromProvider(uri, e.payload.key);
        expect(result[provider.key]).not.toBeUndefined();
        expect(result[provider.key][0]).not.toBeUndefined();

        expect(result[provider.key][0].options.className).toEqual(className);
        done();
      }
    });
    className = 'testDecoration2';
    _decorationChange.fire(uri);

    disposer.dispose();
    done();
  });

  it('decoration applier test', async (done) => {
    injector.mockService(IThemeService, {
      getCurrentThemeSync: jest.fn(() => ({
        type: 'dark',
      })),
    });
    injector.mockService(ICSSStyleService, {
      addClass: jest.fn(() => new Disposable()),
    });

    const disposer = decorationService.createTextEditorDecorationType(
      {
        backgroundColor: 'black',
        after: {
          backgroundColor: 'red',
        },
        before: {
          backgroundColor: 'green',
        },
      },
      'test2',
    );
    const disposer2 = decorationService.registerDecorationProvider(provider);

    const editor = mockedMonaco.editor!.create(document.createElement('div'));

    editor.setModel(mockedMonaco.editor!.createModel('', undefined, mockedMonaco.Uri!.parse('file:///test/test.js')));

    const applier = injector.get(MonacoEditorDecorationApplier, [editor]);

    applier.applyDecoration('test2', [
      {
        range: {
          startLineNumber: 1,
          endColumn: 1,
          startColumn: 1,
          endLineNumber: 1,
        },
        hoverMessage: 'testHoverMessage',
      },
    ]);

    expect(editor.deltaDecorations).toBeCalled();
    (editor.deltaDecorations as any).mockClear();

    const eventBus: IEventBus = injector.get(IEventBus);

    await eventBus.fireAndAwait(new EditorDecorationTypeRemovedEvent('test2'));

    expect(editor.deltaDecorations).toBeCalled();
    (editor.deltaDecorations as any).mockClear();

    (editor as any)._onDidChangeModel.fire();

    expect(editor.deltaDecorations).toBeCalled();
    (editor.deltaDecorations as any).mockClear();

    await eventBus.fireAndAwait(
      new EditorDecorationChangeEvent({
        uri: new URI('file:///test/test.js'),
        key: 'test',
      }),
    );

    expect(editor.deltaDecorations).toBeCalled();
    (editor.deltaDecorations as any).mockClear();

    disposer.dispose();
    disposer2.dispose();
    done();
  });

  afterAll(() => {
    injector.disposeAll();
  });
});
