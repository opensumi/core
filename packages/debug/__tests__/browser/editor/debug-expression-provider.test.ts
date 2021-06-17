import * as monaco from '@ali/monaco-editor-core/esm/vs/editor/editor.api';
import { createBrowserInjector } from '@ali/ide-dev-tool/src/injector-helper';
import { DebugExpressionProvider } from '@ali/ide-debug/lib/browser/editor';
import type { ITextModel } from '@ali/monaco-editor-core/esm/vs/editor/common/model';
import { EvaluatableExpressionServiceImpl, IEvaluatableExpressionService } from '@ali/ide-debug/lib/browser/editor/evaluatable-expression';

describe('Debug Expression Provider', () => {
  const mockInjector = createBrowserInjector([]);
  let debugExpressionProvider: DebugExpressionProvider;
  const textModel = monaco.editor.createModel('test.a = "test"', 'test');

  const mockedGetLineContent = jest.spyOn(textModel, 'getLineContent');
  mockInjector.addProviders({
    token: IEvaluatableExpressionService,
    useClass: EvaluatableExpressionServiceImpl,
  });

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

  it('get method should be work', async () => {
    const expression = await debugExpressionProvider.get(textModel as unknown as ITextModel, selection);
    expect(mockedGetLineContent).toBeCalledWith(selection.startLineNumber);
    expect(expression).toBe('test.a');
  });
});
