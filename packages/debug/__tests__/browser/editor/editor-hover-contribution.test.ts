import { Disposable, IContextKeyService } from '@ali/ide-core-browser';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { EditorHoverContribution } from '@ali/ide-debug/lib/browser/editor/editor-hover-contribution';

describe('Editor Hover Contribution', () => {
  const mockInjector = createBrowserInjector([]);
  let contribution: EditorHoverContribution;

  const mockContextKeyService = {
    onDidChangeContext: jest.fn(() => Disposable.create(() => {})),
    match: jest.fn(),
  };
  beforeAll(() => {
    mockInjector.overrideProviders({
      token: IContextKeyService,
      useValue: mockContextKeyService,
    });

    contribution = mockInjector.get(EditorHoverContribution);
  });

  it('should have enough API', () => {
    expect(typeof contribution.contribute).toBe('function');
    expect(typeof contribution.updateHoverEnabled).toBe('function');
  });

  it('contribute method should be work', () => {
    const mockEditor = {
      monacoEditor: {
        updateOptions: jest.fn(),
      },
    };
    contribution.contribute(mockEditor as any);
    expect(mockContextKeyService.onDidChangeContext).toBeCalledTimes(1);
    expect(mockContextKeyService.match).toBeCalledTimes(1);
    expect(mockEditor.monacoEditor.updateOptions).toBeCalledTimes(1);
  });
});
