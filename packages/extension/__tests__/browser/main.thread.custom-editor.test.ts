import { RPCProtocol } from '@opensumi/ide-connection';
import { Emitter, IEventBus, URI, CancellationTokenSource } from '@opensumi/ide-core-common';
import { ResourceDecorationNeedChangeEvent } from '@opensumi/ide-editor/lib/browser/types';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/src/browser';
import { MainThreadWebview } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.api.webview';
import { MainThreadCustomEditor } from '@opensumi/ide-extension/lib/browser/vscode/api/main.thread.custom-editor';
import { MainThreadAPIIdentifier, ExtHostAPIIdentifier } from '@opensumi/ide-extension/lib/common/vscode';
import {
  IExtHostCustomEditor,
  CustomEditorType,
  CustomEditorOptionChangeEvent,
  CustomEditorShouldDisplayEvent,
  CustomEditorShouldEditEvent,
  CustomEditorShouldSaveEvent,
  CustomEditorShouldRevertEvent,
} from '@opensumi/ide-extension/lib/common/vscode/custom-editor';
import { IWebviewService } from '@opensumi/ide-webview/lib/browser/types';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { mockService, MockInjector } from '../../../../tools/dev-tool/src/mock-injector';

const emitterA = new Emitter<any>();
const emitterB = new Emitter<any>();

const mockClientA = {
  send: (msg) => emitterB.fire(msg),
  onMessage: emitterA.event,
};
const mockClientB = {
  send: (msg) => emitterA.fire(msg),
  onMessage: emitterB.event,
};

const rpcProtocolExt = new RPCProtocol(mockClientA);
const rpcProtocolMain = new RPCProtocol(mockClientB);

let extHost: IExtHostCustomEditor;
let mainThread: MainThreadCustomEditor;

describe('MainThread CustomEditor Test', () => {
  let injector: MockInjector;

  let mockWebviewService: IWebviewService;
  let mockEditorDocService: IEditorDocumentModelService;
  let mainThreadWebviewMock: MainThreadWebview;

  beforeEach(() => {
    injector = createBrowserInjector([]);
    mockWebviewService = mockService({});
    mockEditorDocService = mockService({});
    injector.addProviders(
      {
        token: IWebviewService,
        useValue: mockWebviewService,
      },
      {
        token: IEditorDocumentModelService,
        useValue: mockEditorDocService,
      },
    );
    mainThreadWebviewMock = mockService({});
    extHost = rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostCustomEditor, mockService({}));
    mainThread = injector.get(MainThreadCustomEditor, [rpcProtocolMain, mainThreadWebviewMock]);
    rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadCustomEditor, mockService({}));
  });

  afterEach(() => {
    injector.disposeAll();
  });

  it('resolve text editor', async (done) => {
    const viewType = 'test viewType';
    const testExtInfo = {
      id: 'test-extension',
      extensionId: 'test-extension',
      isBuiltin: true,
    };

    const CustomEditorOptionChangeEventListener = jest.fn();
    const eventBus: IEventBus = injector.get(IEventBus);

    eventBus.on(CustomEditorOptionChangeEvent, CustomEditorOptionChangeEventListener);

    await mainThread.$registerCustomEditor(viewType, CustomEditorType.TextEditor, {}, testExtInfo);

    expect(CustomEditorOptionChangeEventListener).toBeCalled();

    const fileUri = new URI('file:///test/test1.json');
    const webviewPanelId = 'test_webviewPanel_Id';
    const openTypeId = 'vscode_customEditor_' + viewType;

    const webview: any = {
      id: webviewPanelId,
    };

    mockWebviewService.getWebview = (id) => {
      if (id === webviewPanelId) {
        return webview;
      } else {
        return null;
      }
    };

    mockEditorDocService.createModelReference = async (uri) => {
      if (uri.isEqual(fileUri)) {
        const ref = {
          instance: {
            uri,
          } as any,
          dispose: () => {},
          hold: () => ref,
        };
        return ref as any;
      } else {
        throw new Error('no doc!');
      }
    };

    // 用户打开指定文件后会发送 CustomEditorShouldDisplayEvent 事件，此时应该开始展示
    await eventBus.fireAndAwait(
      new CustomEditorShouldDisplayEvent({
        uri: fileUri,
        viewType,
        webviewPanelId,
        openTypeId,
        cancellationToken: new CancellationTokenSource().token,
      }),
    );

    expect(mainThreadWebviewMock.pipeBrowserHostedWebviewPanel).toBeCalledWith(
      webview,
      {
        uri: fileUri,
        openTypeId,
      },
      viewType,
      {},
      testExtInfo,
    );

    done();
  });

  it('resolve custom editor', async (done) => {
    const viewType = 'test viewType 2';
    const testExtInfo = {
      id: 'test-extension',
      extensionId: 'test-extension',
      isBuiltin: true,
    };

    const eventBus: IEventBus = injector.get(IEventBus);

    const CustomEditorOptionChangeEventListener = jest.fn();
    eventBus.on(CustomEditorOptionChangeEvent, CustomEditorOptionChangeEventListener);

    await mainThread.$registerCustomEditor(viewType, CustomEditorType.FullEditor, {}, testExtInfo);

    expect(CustomEditorOptionChangeEventListener).toBeCalled();

    const fileUri = new URI('file:///test/test2.json');
    const webviewPanelId = 'test_webviewPanel_Id2';
    const openTypeId = 'vscode_customEditor_' + viewType;

    const webview: any = {
      id: webviewPanelId,
    };

    mockWebviewService.getWebview = (id) => {
      if (id === webviewPanelId) {
        return webview;
      } else {
        return null;
      }
    };

    // 用户打开指定文件后会发送 CustomEditorShouldDisplayEvent 事件，此时应该开始展示
    await eventBus.fireAndAwait(
      new CustomEditorShouldDisplayEvent({
        uri: fileUri,
        viewType,
        webviewPanelId,
        openTypeId,
        cancellationToken: new CancellationTokenSource().token,
      }),
    );

    expect(mainThreadWebviewMock.pipeBrowserHostedWebviewPanel).toBeCalledWith(
      webview,
      {
        uri: fileUri,
        openTypeId,
      },
      viewType,
      {},
      testExtInfo,
    );

    // 用户执行一次 undo
    await eventBus.fireAndAwait(
      new CustomEditorShouldEditEvent({
        uri: fileUri,
        viewType,
        type: 'undo',
      }),
    );

    expect(extHost.$undo).toBeCalledWith(viewType, fileUri.codeUri);

    // 用户执行一次 redo
    await eventBus.fireAndAwait(
      new CustomEditorShouldEditEvent({
        uri: fileUri,
        viewType,
        type: 'redo',
      }),
    );

    expect(extHost.$redo).toBeCalledWith(viewType, fileUri.codeUri);

    // 用户执行一次 save
    await eventBus.fireAndAwait(
      new CustomEditorShouldSaveEvent({
        uri: fileUri,
        viewType,
        cancellationToken: new CancellationTokenSource().token,
      }),
    );

    expect(extHost.$saveCustomDocument).toBeCalledWith(viewType, fileUri.codeUri, expect.anything());

    // 用户执行一次 revert
    await eventBus.fireAndAwait(
      new CustomEditorShouldRevertEvent({
        uri: fileUri,
        viewType,
        cancellationToken: new CancellationTokenSource().token,
      }),
    );

    expect(extHost.$revertCustomDocument).toBeCalledWith(viewType, fileUri.codeUri, expect.anything());

    // extHost 进程报告一次 dirty
    const ResourceDecorationNeedUpdateListener = jest.fn();
    eventBus.on(ResourceDecorationNeedChangeEvent, ResourceDecorationNeedUpdateListener);

    mainThread.$acceptCustomDocumentDirty(fileUri.codeUri, true);
    expect(ResourceDecorationNeedUpdateListener).toBeCalledWith(
      expect.objectContaining({
        payload: {
          uri: fileUri,
          decoration: {
            dirty: true,
          },
        },
      }),
    );

    ResourceDecorationNeedUpdateListener.mockClear();
    mainThread.$acceptCustomDocumentDirty(fileUri.codeUri, false);
    expect(ResourceDecorationNeedUpdateListener).toBeCalledWith(
      expect.objectContaining({
        payload: {
          uri: fileUri,
          decoration: {
            dirty: false,
          },
        },
      }),
    );

    done();
  });
});
