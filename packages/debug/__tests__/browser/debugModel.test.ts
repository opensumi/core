import { enableJSDOM } from '@ali/ide-core-browser/lib/mocks/jsdom';
const disableJSDOM = enableJSDOM();
import { URI, Disposable, DisposableCollection } from '@ali/ide-core-browser';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';
import { DebugModel } from '@ali/ide-debug/lib/browser/editor';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { DebugModule } from '@ali/ide-debug/lib/browser';
import { IDebugModel } from '@ali/ide-debug';
disableJSDOM();

process.on('unhandledRejection', (reason, promise) => {
  console.error(reason);
});

describe('Debug Model', () => {

  let model: IDebugModel;
  let injector: MockInjector;
  let mockDebugEditor: any;

  const toTearDown = new DisposableCollection();

  const initializeInjector = async () => {
    toTearDown.push(Disposable.create(enableJSDOM()));
    mockDebugEditor = createMockedMonaco().editor!;
    injector = createBrowserInjector([
      DebugModule,
    ]);
  };

  beforeEach(() => {
    return initializeInjector();
  });

  afterEach(() => toTearDown.dispose());

  it('breakpoint simple', () => {
    const modelUri = URI.file('/myfolder/myfile.js');
    model = DebugModel.createModel(injector, mockDebugEditor);
  });
});
