import { URI, Disposable, DisposableCollection, IFileServiceClient, IContextKeyService } from '@ali/ide-core-browser';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { DebugModel, DebugModelManager } from '@ali/ide-debug/lib/browser/editor';
import { DebugModule, DebugStackFrame, DebugThread, DebugSession, DebugSessionConnection, BreakpointManager } from '@ali/ide-debug/lib/browser';
import { DebugSessionOptions, IDebugSessionManager } from '@ali/ide-debug';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { MockContextKeyService } from '@ali/ide-core-browser/__mocks__/context-key';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { IMessageService } from '@ali/ide-overlay';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ITerminalApiService } from '@ali/ide-terminal-next';

process.on('unhandledRejection', (reason, promise) => {
  // console.error(reason);
});

describe('Debug Model', () => {

  let model: DebugModel;
  let injector: MockInjector;
  let mockDebugEditor: any;
  const testFile: URI = URI.file('/myfolder/myfile.js');

  const enableMonaCo = () => {
    (global as any).monaco = {
      Range: class Range {},
    };
    const disableMonaco = () => {
      delete (global as any).monaco;
    };
    return disableMonaco;
  };

  const toTearDown = new DisposableCollection();

  const initializeInjector = async () => {
    toTearDown.push(Disposable.create(enableMonaCo()));

    mockDebugEditor = {
      ...createMockedMonaco().editor!,
      getModel: () => {
        return {
          uri: testFile,
        };
      },
      addContentWidget: () => {

      },
      onKeyDown: () => Disposable.create(() => {}),
    };
    injector = createBrowserInjector([
      DebugModule,
    ]);
    injector.addProviders({
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    });
    injector.addProviders({
      token: IContextKeyService,
      useClass: MockContextKeyService,
    });
    injector.addProviders({
      token: IFileServiceClient,
      useClass: MockFileServiceClient,
    });
  };

  beforeEach(() => {
    return initializeInjector();
  });

  afterEach(() => toTearDown.dispose());

  it('debugModel render', () => {
    const deltaDecorationsFn = jest.fn(() => []);
    mockDebugEditor = {
      ...mockDebugEditor,
      deltaDecorations: deltaDecorationsFn,
    };
    model = DebugModel.createModel(injector, mockDebugEditor) as DebugModel;
    model.render();
    expect(deltaDecorationsFn).toBeCalled();
  });

  it('stackFrame focusing', () => {
    const deltaDecorationsFn = jest.fn(() => []);
    mockDebugEditor = {
      ...mockDebugEditor,
      deltaDecorations: deltaDecorationsFn,
    };
    model = DebugModel.createModel(injector, mockDebugEditor) as DebugModel;
    const fakeSession = new DebugSession(
      '0',
      {} as DebugSessionOptions,
      {
        onRequest: (command: string, handler) => {},
        on: (command: string, handler) => Disposable.create(() => {}),
        dispose: () => {},
      } as DebugSessionConnection,
      {} as ITerminalApiService,
      {} as WorkbenchEditorService,
      injector.get(BreakpointManager),
      injector.get(DebugModelManager),
      injector.get(LabelService),
      {} as IMessageService,
      injector.get(IFileServiceClient),
      injector.get(IDebugSessionManager),
    );
    const thread = new DebugThread(fakeSession);
    const frame = new DebugStackFrame(thread, fakeSession);
    frame.update({
      raw: {
        id: 0,
        name: 'fake',
        line: 5,
        column: 2,
      },
    });
    model.focusStackFrame(frame);
    expect(deltaDecorationsFn).toBeCalledTimes(0);
  });
});
