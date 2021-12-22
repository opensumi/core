import { URI, Disposable, DisposableCollection, IContextKeyService } from '@opensumi/ide-core-browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { DebugModel, DebugModelManager } from '@opensumi/ide-debug/lib/browser/editor';
import {
  DebugModule,
  DebugStackFrame,
  DebugThread,
  DebugSession,
  DebugSessionConnection,
  BreakpointManager,
} from '@opensumi/ide-debug/lib/browser';
import { DebugSessionOptions, IDebugSessionManager } from '@opensumi/ide-debug';
import { MockFileServiceClient } from '@opensumi/ide-file-service/lib/common/mocks';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { IMessageService } from '@opensumi/ide-overlay';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ITerminalApiService } from '@opensumi/ide-terminal-next';

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
      ...createMockedMonaco().editor,
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
        onRequest: (command: string, handler) => {
          console.log(`Request ${command} with handle ${handler.name}`);
        },
        on: (command: string, handler) => {
          console.log(`Request ${command} with handle ${handler.name}`);
          return Disposable.create(() => {});
        },
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
