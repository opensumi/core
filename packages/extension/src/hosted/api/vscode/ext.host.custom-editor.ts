import { CustomDocumentOpenContext } from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import { IDisposable, CancellationToken, IExtensionInfo, Emitter, Schemas } from '@opensumi/ide-core-common';
import { iconvEncode } from '@opensumi/ide-core-common/lib/encoding';
import { UriComponents } from '@opensumi/ide-editor';

import {
  IExtHostCustomEditor,
  IMainThreadCustomEditor,
  MainThreadAPIIdentifier,
  CustomEditorType,
  ExtensionDocumentDataManager,
  IWebviewPanelOptions,
  TCustomEditorProvider,
} from '../../../common/vscode';
import {
  CustomEditorProvider,
  CustomReadonlyEditorProvider,
  CustomTextEditorProvider,
  CustomDocument,
  CustomDocumentEditEvent,
  CustomDocumentContentChangeEvent,
} from '../../../common/vscode/custom-editor';
import { Uri } from '../../../common/vscode/ext-types';

import { ExtHostWebviewService } from './ext.host.api.webview';


export class ExtHostCustomEditorImpl implements IExtHostCustomEditor {
  private proxy: IMainThreadCustomEditor;

  private providers = new Map<string, TCustomEditorProvider>();

  private customDocuments = new Map<
    string,
    {
      documents: Map<string, CustomDocumentHostData<any>>;
      provider: CustomEditorProvider | CustomReadonlyEditorProvider;
    }
  >();

  constructor(
    rpcProtocol: IRPCProtocol,
    private webview: ExtHostWebviewService,
    private extDocuments: ExtensionDocumentDataManager,
  ) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadCustomEditor);
  }

  registerCustomEditorProvider(
    viewType: string,
    provider: CustomTextEditorProvider | CustomEditorProvider | CustomReadonlyEditorProvider,
    options: { supportsMultipleEditorsPerDocument?: boolean; webviewOptions?: IWebviewPanelOptions },
    extensionInfo: IExtensionInfo,
  ): IDisposable {
    const type = getEditorType(provider);
    this.proxy.$registerCustomEditor(viewType, type, options, extensionInfo);
    this.providers.set(viewType, {
      type,
      provider: provider as any,
    });
    if (type === CustomEditorType.FullEditor || type === CustomEditorType.ReadonlyEditor) {
      this.customDocuments.set(viewType, {
        provider: provider as any,
        documents: new Map(),
      });
    }
    return {
      dispose: () => {
        this.providers.delete(viewType);
        this.customDocuments.delete(viewType);
        this.proxy.$unregisterCustomEditor(viewType);
      },
    };
  }

  async $saveCustomDocument(viewType: string, uriComp: UriComponents, token: CancellationToken) {
    const uri = Uri.revive(uriComp);
    const document = this.customDocuments.get(viewType)?.documents?.get(uri.toString());
    if (document) {
      await document.save(token);
    }
  }

  async $revertCustomDocument(viewType: string, uriComp: UriComponents, token: CancellationToken) {
    const uri = Uri.revive(uriComp);
    const document = this.customDocuments.get(viewType)?.documents?.get(uri.toString());
    if (document) {
      await document.revert(token);
    }
  }

  async $resolveCustomTextEditor(
    viewType: string,
    uriParts: UriComponents,
    webviewPanelId: string,
    token: CancellationToken,
  ) {
    const provider = this.providers.get(viewType);
    if (!provider) {
      throw new Error(`no custom editor provider for ${viewType}`);
    }

    const webviewPanel = this.webview.getWebviewPanel(webviewPanelId);
    if (!webviewPanel) {
      throw new Error(`no webview ${webviewPanelId} for custom editor ${viewType}`);
    }

    const uri = Uri.revive(uriParts);
    if (provider.type === CustomEditorType.TextEditor) {
      const document = this.extDocuments.getDocument(uri);
      if (!document) {
        throw new Error(`no document ${uri.toString()} for custom editor ${viewType}`);
      }
      provider.provider.resolveCustomTextEditor(document, webviewPanel, token);
    } else {
      let document = this.getCustomDocument(viewType, uri)?.document;
      if (!document) {
        const openContext: CustomDocumentOpenContext = {};
        if (uri.scheme === Schemas.untitled) {
          const untitledDoc = this.extDocuments.getDocument(uri);
          // untitled 默认都是 utf8 编码
          openContext.untitledDocumentData = untitledDoc && iconvEncode(untitledDoc.getText(), 'utf-8');
        }
        document = await provider.provider.openCustomDocument(uri, openContext, token);
        if (!document) {
          return;
        }
        const data = new CustomDocumentHostData(document, provider.provider);
        this.customDocuments.get(viewType)?.documents.set(uri.toString(), data);
        data.onDidChange(() => {
          this.proxy.$acceptCustomDocumentDirty(uri, data.dirty);
        });
        if (token.isCancellationRequested) {
          return;
        }
      }
      provider.provider.resolveCustomEditor(document, webviewPanel, token);
    }
  }

  private getCustomDocument(viewType: string, uri: Uri): CustomDocumentHostData | undefined {
    return this.customDocuments.get(viewType)?.documents?.get(uri.toString());
  }

  async $undo(viewType: string, uriParts: Uri) {
    const uri = Uri.revive(uriParts);
    const document = this.getCustomDocument(viewType, uri);
    if (document) {
      await document.undo();
    }
  }

  async $redo(viewType: string, uriParts: Uri) {
    const uri = Uri.revive(uriParts);
    const document = this.getCustomDocument(viewType, uri);
    if (document) {
      await document.redo();
    }
  }
}

function getEditorType(
  provider: CustomTextEditorProvider | CustomEditorProvider | CustomReadonlyEditorProvider,
): CustomEditorType {
  if (typeof (provider as CustomEditorProvider).saveCustomDocument === 'function') {
    return CustomEditorType.FullEditor;
  } else if (typeof (provider as CustomReadonlyEditorProvider).openCustomDocument === 'function') {
    return CustomEditorType.ReadonlyEditor;
  } else {
    return CustomEditorType.TextEditor;
  }
}

class CustomDocumentHostData<T extends CustomDocument = any> {
  private edits: CustomDocumentEditEvent<T>[] = [];

  private currentIndex = -1;

  private savePoint = -1;

  private _onDidChange = new Emitter<void>();
  public onDidChange = this._onDidChange.event;

  private _forceDirty = false;

  constructor(private _document: T, private provider: CustomEditorProvider<T> | CustomReadonlyEditorProvider<T>) {
    if (isNotReadonlyProvider(this.provider)) {
      this.provider.onDidChangeCustomDocument((e) => {
        if (e.document !== this.document) {
          return;
        }
        if (isEditEvent<T>(e)) {
          this.addEdit(e);
        } else {
          this._forceDirty = true;
          this._onDidChange.fire();
        }
      });
    }
  }

  addEdit(edit: CustomDocumentEditEvent<T>) {
    if (this.currentIndex !== this.edits.length - 1) {
      this.edits.splice(this.currentIndex + 1, this.edits.length - this.currentIndex - 1);
    }
    this.edits.push(edit);
    this.currentIndex = this.edits.length - 1;
    // 添加编辑后，如果 savePoint 在 currentIndex 之后，说明这个savePoint 永远无法再达到了，设置为 -1
    if (this.savePoint >= this.currentIndex) {
      this.savePoint = -2;
    }
    this._onDidChange.fire();
  }

  get document() {
    return this._document;
  }

  async undo() {
    if (this.edits[this.currentIndex]) {
      const edit = this.edits[this.currentIndex];
      this.currentIndex--;
      await edit.undo();
      this._onDidChange.fire();
    }
  }

  async redo() {
    if (this.edits[this.currentIndex + 1]) {
      const edit = this.edits[this.currentIndex + 1];
      this.currentIndex++;
      await edit.redo();
      this._onDidChange.fire();
    }
  }

  async save(token: CancellationToken) {
    if (isNotReadonlyProvider(this.provider)) {
      await this.provider.saveCustomDocument(this.document, token);
      this.savePoint = this.currentIndex;
      this._forceDirty = false;
      this._onDidChange.fire();
    }
  }

  async revert(token: CancellationToken) {
    if (isNotReadonlyProvider(this.provider)) {
      await this.provider.revertCustomDocument(this.document, token);
      this.currentIndex = this.savePoint;
      this._forceDirty = false;
      this._onDidChange.fire();
    }
  }

  get dirty(): boolean {
    if (this._forceDirty) {
      return true;
    }
    return this.currentIndex !== this.savePoint;
  }
}

function isNotReadonlyProvider<T extends CustomDocument>(
  provider: CustomEditorProvider<T> | CustomReadonlyEditorProvider<T>,
): provider is CustomEditorProvider<T> {
  return typeof (provider as CustomEditorProvider<T>).saveCustomDocument === 'function';
}

function isEditEvent<T extends CustomDocument>(
  e: CustomDocumentEditEvent<T> | CustomDocumentContentChangeEvent<T>,
): e is CustomDocumentEditEvent<T> {
  return (e as CustomDocumentEditEvent<T>).undo !== undefined && (e as CustomDocumentEditEvent<T>).redo !== undefined;
}
