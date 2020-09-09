import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DebugExpressionProvider } from '@ali/ide-debug/lib/browser/editor';

describe('Debug Expression Provider', () => {
  const mockInjector = createBrowserInjector([]);
  let debugExpressionProvider: DebugExpressionProvider;
  const mockTextModel = {
    getLineContent: jest.fn(() => 'test.a = "test"'),
  } as any;

  const selection = {
    startLineNumber: 1,
    endLineNumber: 2,
    startColumn: 1,
    endColumn: 7,
  } as any;

  beforeAll(() => {
    debugExpressionProvider = mockInjector.get(DebugExpressionProvider);
  });

  it('should have enough API', () => {
    expect(typeof debugExpressionProvider.get).toBe('function');
  });

  it('get method should be work', () => {
    const expression = debugExpressionProvider.get(mockTextModel, selection);
    expect(mockTextModel.getLineContent).toBeCalledWith(selection.startLineNumber);
    expect(expression).toBe('test.a');
  });
});
