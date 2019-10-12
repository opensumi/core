import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IEditorDecorationCollectionService, EditorDecorationChangeEvent } from '@ali/ide-editor/lib/browser';
import { EditorDecorationCollectionService } from '@ali/ide-editor/lib/browser/editor.decoration.service';
import { URI, Emitter, IEventBus } from '@ali/ide-core-browser';

describe('editor decoration service test', () => {

  const injector = createBrowserInjector([]);

  injector.addProviders({
    token: IEditorDecorationCollectionService,
    useClass : EditorDecorationCollectionService,
  });

  const decorationService: IEditorDecorationCollectionService = injector.get(IEditorDecorationCollectionService);
  const decorationServiceImpl = decorationService as EditorDecorationCollectionService;

  const _decorationChange = (new Emitter<URI>());
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
              className,
              isWholeLine: true,
            },
          },
        ];
      }
    },
    onDidDecorationChange: _decorationChange.event,
  };

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
  });

});
