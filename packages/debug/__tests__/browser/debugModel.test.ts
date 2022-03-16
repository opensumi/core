import {
  URI,
  Disposable,
  DisposableCollection,
  IFileServiceClient,
  IContextKeyService,
} from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { DebugSessionOptions, IDebugSessionManager } from '@opensumi/ide-debug';
import {
  DebugModule,
  DebugStackFrame,
  DebugThread,
  DebugSession,
  DebugSessionConnection,
  BreakpointManager,
} from '@opensumi/ide-debug/lib/browser';
import { DebugModel, DebugModelManager } from '@opensumi/ide-debug/lib/browser/editor';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { IMessageService } from '@opensumi/ide-overlay';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';

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
      getModel: () => ({
        uri: testFile,
      }),
      addContentWidget: () => {},
      onKeyDown: () => Disposable.create(() => {}),
    };
    injector = createBrowserInjector([DebugModule]);
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

  beforeEach(() => initializeInjector());

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
    model.focusStackFrame();
    expect(deltaDecorationsFn).toBeCalledTimes(0);
  });
});
