import { URI, Disposable, DisposableCollection, IFileServiceClient, IContextKeyService } from '@ide-framework/ide-core-browser';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { DebugModel, DebugModelManager } from '@ide-framework/ide-debug/lib/browser/editor';
import { DebugModule, DebugStackFrame, DebugThread, DebugSession, DebugSessionConnection, BreakpointManager } from '@ide-framework/ide-debug/lib/browser';
import { DebugSessionOptions, IDebugSessionManager } from '@ide-framework/ide-debug';
import { MockFileServiceClient } from '@ide-framework/ide-file-service/lib/common/mocks';
import { MockContextKeyService } from '@ide-framework/ide-core-browser/__mocks__/context-key';
import { WorkbenchEditorService } from '@ide-framework/ide-editor';
import { LabelService } from '@ide-framework/ide-core-browser/lib/services';
import { IMessageService } from '@ide-framework/ide-overlay';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ITerminalApiService } from '@ide-framework/ide-terminal-next';

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
