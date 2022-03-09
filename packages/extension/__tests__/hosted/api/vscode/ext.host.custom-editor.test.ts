import { RPCProtocol } from '@opensumi/ide-connection';
import { Emitter, CancellationTokenSource, Uri } from '@opensumi/ide-core-common';
import { URI } from '@opensumi/ide-core-common';
import {
  MainThreadAPIIdentifier,
  ExtHostAPIIdentifier,
  ExtensionDocumentDataManager,
} from '@opensumi/ide-extension/lib/common/vscode';
import {
  IMainThreadCustomEditor,
  CustomTextEditorProvider,
  CustomEditorType,
  CustomEditorProvider,
  CustomDocument,
  CustomDocumentEditEvent,
  CustomDocumentContentChangeEvent,
} from '@opensumi/ide-extension/lib/common/vscode/custom-editor';
import { ExtHostWebviewService } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.api.webview';
import { ExtHostCustomEditorImpl } from '@opensumi/ide-extension/lib/hosted/api/vscode/ext.host.custom-editor';

import { mockService } from '../../../../../../tools/dev-tool/src/mock-injector';


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

let extHost: ExtHostCustomEditorImpl;
let mainThread: IMainThreadCustomEditor;

describe('vscode extHost CustomEditor Test', () => {
  let extHostWebviewMock: ExtHostWebviewService;
  let extHostDocumentsMock: ExtensionDocumentDataManager;

  beforeEach(() => {
    extHostWebviewMock = mockService({});
    extHostDocumentsMock = mockService({});
    extHost = new ExtHostCustomEditorImpl(rpcProtocolExt, extHostWebviewMock, extHostDocumentsMock);
    rpcProtocolExt.set(ExtHostAPIIdentifier.ExtHostCustomEditor, extHost);
    mainThread = rpcProtocolMain.set(MainThreadAPIIdentifier.MainThreadCustomEditor, mockService({}));
  });

  it('customTextEditor Test', async (done) => {
    const viewType = 'test CustomTextEditor';

    const customTextEditorProvider: CustomTextEditorProvider = {
      resolveCustomTextEditor: jest.fn((document, webviewPanel, token) => {}),
    };

    extHost.registerCustomEditorProvider(
      viewType,
      customTextEditorProvider,
      {},
      {
        id: 'test-extension',
        extensionId: 'test-extension',
        isBuiltin: true,
      },
    );

    await waitIPC();

    expect(mainThread.$registerCustomEditor).toBeCalledWith(
      viewType,
      CustomEditorType.TextEditor,
      {},
      expect.objectContaining({
        id: 'test-extension',
        extensionId: 'test-extension',
        isBuiltin: true,
      }),
    );

    const docUri = URI.parse('file:///test/test1.json').codeUri;
    const webviewPanelId = 'test_webviewPanel';

    extHostDocumentsMock.getDocument = (uri) => {
      if (uri.toString() === docUri.toString()) {
        return {
          uri: docUri,
        } as any;
      } else {
        return null;
      }
    };

    extHostWebviewMock.getWebviewPanel = (id) => {
      if (id === webviewPanelId) {
        return {
          id: webviewPanelId,
        } as any;
      } else {
      }
    };
    extHost.$resolveCustomTextEditor(viewType, docUri, webviewPanelId, new CancellationTokenSource().token);

    await waitIPC();

    expect(customTextEditorProvider.resolveCustomTextEditor).toBeCalledWith(
      expect.objectContaining({
        uri: docUri,
      }),
      {
        id: webviewPanelId,
      },
      expect.anything(),
    );

    done();
  });

  it('customEditor Test', async (done) => {
    const viewType = 'test CustomEditor';

    const _onDidChangeCustomDocument = new Emitter<
      CustomDocumentEditEvent<TestCustomEditorDocument> | CustomDocumentContentChangeEvent<TestCustomEditorDocument>
    >();

    const docs = new Map<string, TestCustomEditorDocument>();

    const customEditorProvider: CustomEditorProvider<TestCustomEditorDocument> = {
      openCustomDocument: (uri: Uri) => {
        const doc = new TestCustomEditorDocument(uri);
        docs.set(uri.toString(), doc);
        return doc;
      },
      onDidChangeCustomDocument: _onDidChangeCustomDocument.event,
      saveCustomDocument: async (doc: TestCustomEditorDocument) => {
        await doc.save();
      },
      revertCustomDocument: async (doc: TestCustomEditorDocument) => {
        await doc.revert();
      },
      resolveCustomEditor: jest.fn(() => {}),
    };

    extHost.registerCustomEditorProvider(
      viewType,
      customEditorProvider,
      {},
      {
        id: 'test-extension',
        extensionId: 'test-extension',
        isBuiltin: true,
      },
    );

    await waitIPC();

    expect(mainThread.$registerCustomEditor).toBeCalledWith(
      viewType,
      CustomEditorType.FullEditor,
      {},
      expect.objectContaining({
        id: 'test-extension',
        extensionId: 'test-extension',
        isBuiltin: true,
      }),
    );

    const docUri = URI.parse('file:///test/test1.customExt').codeUri;
    const webviewPanelId = 'test_webviewPanel_2';

    extHostDocumentsMock.getDocument = (uri) => {
      if (uri.toString() === docUri.toString()) {
        return {
          uri: docUri,
        } as any;
      } else {
        return null;
      }
    };

    extHostWebviewMock.getWebviewPanel = (id) => {
      if (id === webviewPanelId) {
        return {
          id: webviewPanelId,
        } as any;
      } else {
      }
    };

    extHost.$resolveCustomTextEditor(viewType, docUri, webviewPanelId, new CancellationTokenSource().token);

    await waitIPC();

    expect(customEditorProvider.resolveCustomEditor).toBeCalledWith(
      expect.any(TestCustomEditorDocument),
      {
        id: webviewPanelId,
      },
      expect.anything(),
    );

    expect(customEditorProvider.resolveCustomEditor).toBeCalledWith(
      expect.objectContaining({
        uri: docUri,
      }),
      {
        id: webviewPanelId,
      },
      expect.anything(),
    );

    const doc = docs.get(docUri.toString());

    expect(doc).toBeDefined();

    // 保存自定义文档
    expect(doc?.saved).toBeFalsy();
    await extHost.$saveCustomDocument(viewType, docUri, new CancellationTokenSource().token);
    expect(doc?.saved).toBeTruthy();
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), false);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    // 回滚自定义文档
    expect(doc?.reverted).toBeFalsy();
    await extHost.$revertCustomDocument(viewType, docUri, new CancellationTokenSource().token);
    expect(doc?.reverted).toBeTruthy();
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), false);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    // 产生一次变更

    const edit: CustomDocumentEditEvent<TestCustomEditorDocument> = {
      document: doc!,
      undo: jest.fn(),
      redo: jest.fn(),
    };

    _onDidChangeCustomDocument.fire(edit);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), true);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    await extHost.$undo(viewType, docUri);
    expect(edit.undo).toBeCalledTimes(1);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), false);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    await extHost.$redo(viewType, docUri);
    expect(edit.redo).toBeCalledTimes(1);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), true);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    // 此时保存
    await extHost.$saveCustomDocument(viewType, docUri, new CancellationTokenSource().token);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), false);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    // 保存后回滚, 此时应该是 dirty
    await extHost.$undo(viewType, docUri);
    expect(edit.undo).toBeCalledTimes(2);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), true);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    // 再 redo 恢复 dirty=false
    await extHost.$redo(viewType, docUri);
    expect(edit.redo).toBeCalledTimes(2);
    await waitIPC();
    expect(mainThread.$acceptCustomDocumentDirty).toBeCalledWith(expect.objectContaining({ path: docUri.path }), false);
    (mainThread.$acceptCustomDocumentDirty as jest.Mock).mockClear();

    done();
  });
});

class TestCustomEditorDocument implements CustomDocument {
  public saved = false;

  public reverted = false;

  public saveAs = jest.fn();

  constructor(public readonly uri: Uri) {}

  dispose(): void {
    throw new Error('Method not implemented.');
  }

  save() {
    this.saved = true;
  }

  revert() {
    this.reverted = true;
  }
}

function waitIPC() {
  return Promise.resolve();
}
