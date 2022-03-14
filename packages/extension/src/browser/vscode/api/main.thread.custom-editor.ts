import { Injectable, Autowired } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { WithEventBus, OnEvent, IExtensionInfo, URI } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService, ResourceDecorationNeedChangeEvent } from '@opensumi/ide-editor/lib/browser';
import { IWebviewService } from '@opensumi/ide-webview';

import {
  IMainThreadCustomEditor,
  IExtHostCustomEditor,
  CustomEditorType,
  ICustomEditorOptions,
  ExtHostAPIIdentifier,
} from '../../../common/vscode';
import {
  CustomEditorShouldDisplayEvent,
  CustomEditorOptionChangeEvent,
  CustomEditorShouldHideEvent,
  CustomEditorShouldSaveEvent,
  CustomEditorShouldRevertEvent,
  CustomEditorShouldEditEvent,
} from '../../../common/vscode/custom-editor';
import { UriComponents } from '../../../common/vscode/models';

import { MainThreadWebview } from './main.thread.api.webview';

@Injectable({ multiple: true })
export class MainThreadCustomEditor extends WithEventBus implements IMainThreadCustomEditor {
  private proxy: IExtHostCustomEditor;

  private customEditors = new Map<
    string,
    {
      type: CustomEditorType;
      options: ICustomEditorOptions;
      extensionInfo: IExtensionInfo;
    }
  >();

  @Autowired(IEditorDocumentModelService)
  editorDocumentModelService: IEditorDocumentModelService;

  @Autowired(IWebviewService)
  webviewService: IWebviewService;

  constructor(protocol: IRPCProtocol, private webview: MainThreadWebview) {
    super();
    this.proxy = protocol.getProxy(ExtHostAPIIdentifier.ExtHostCustomEditor);
  }

  $acceptCustomDocumentDirty(uri: UriComponents, dirty: boolean) {
    this.eventBus.fire(
      new ResourceDecorationNeedChangeEvent({
        uri: URI.from(uri),
        decoration: {
          dirty,
        },
      }),
    );
  }

  @OnEvent(CustomEditorShouldSaveEvent)
  async onShouldSave(e: CustomEditorShouldSaveEvent) {
    const { viewType, uri, cancellationToken } = e.payload;
    const editor = this.customEditors.get(viewType);
    if (editor) {
      if (editor.type === CustomEditorType.TextEditor) {
        const docRef = this.editorDocumentModelService.getModelReference(uri);
        if (docRef) {
          try {
            await docRef.instance.save();
          } finally {
            docRef.dispose();
          }
        }
      } else if (editor.type === CustomEditorType.FullEditor) {
        return this.proxy.$saveCustomDocument(viewType, uri.codeUri, cancellationToken);
      }
    }
  }

  @OnEvent(CustomEditorShouldRevertEvent)
  async onShouldRevert(e: CustomEditorShouldSaveEvent) {
    const { viewType, uri, cancellationToken } = e.payload;
    const editor = this.customEditors.get(viewType);
    if (editor) {
      if (editor.type === CustomEditorType.TextEditor) {
        const docRef = this.editorDocumentModelService.getModelReference(uri);
        if (docRef) {
          try {
            await docRef.instance.revert();
          } finally {
            docRef.dispose();
          }
        }
      } else if (editor.type === CustomEditorType.FullEditor) {
        return this.proxy.$revertCustomDocument(viewType, uri.codeUri, cancellationToken);
      }
    }
  }

  @OnEvent(CustomEditorShouldEditEvent)
  async onShouldEdit(e: CustomEditorShouldEditEvent) {
    const { viewType, uri, type } = e.payload;
    const editor = this.customEditors.get(viewType);
    if (editor) {
      if (editor.type === CustomEditorType.TextEditor) {
        const docRef = this.editorDocumentModelService.getModelReference(uri);
        if (docRef) {
          try {
            if (type === 'undo') {
              await (docRef.instance.getMonacoModel() as any).undo();
            } else {
              await (docRef.instance.getMonacoModel() as any).redo();
            }
          } finally {
            docRef.dispose();
          }
        }
      } else if (editor.type === CustomEditorType.FullEditor) {
        if (type === 'undo') {
          await this.proxy.$undo(viewType, uri.codeUri);
        } else {
          await this.proxy.$redo(viewType, uri.codeUri);
        }
      }
    }
  }

  @OnEvent(CustomEditorShouldDisplayEvent)
  async onCustomEditorShouldDisplayEvent(e: CustomEditorShouldDisplayEvent) {
    const editor = this.customEditors.get(e.payload.viewType);
    if (editor) {
      const { viewType, uri, openTypeId, webviewPanelId, cancellationToken } = e.payload;
      if (editor.type === CustomEditorType.TextEditor) {
        const docRef = await this.editorDocumentModelService.createModelReference(uri);
        if (!docRef) {
          throw new Error(`failed to open document ${uri} for custom editor`);
          return;
        }
        if (cancellationToken.isCancellationRequested) {
          docRef.dispose();
          return;
        }
        const webview = this.webviewService.getWebview(webviewPanelId);
        if (!webview) {
          docRef.dispose();
          throw new Error(`failed to find webview ${webviewPanelId}`);
        }
        this.eventBus.on(CustomEditorShouldHideEvent, (e) => {
          if (uri.isEqual(e.payload.uri)) {
            docRef.dispose();
          }
        });
        this.webview.pipeBrowserHostedWebviewPanel(
          webview,
          {
            uri,
            openTypeId,
          },
          viewType,
          editor.options.webviewOptions || {},
          editor.extensionInfo,
        );
        this.proxy.$resolveCustomTextEditor(viewType, uri.codeUri, webviewPanelId, cancellationToken);
      } else {
        const webview = this.webviewService.getWebview(webviewPanelId);
        if (!webview) {
          throw new Error(`failed to find webview ${webviewPanelId}`);
        }
        this.webview.pipeBrowserHostedWebviewPanel(
          webview,
          {
            uri,
            openTypeId,
          },
          viewType,
          editor.options.webviewOptions || {},
          editor.extensionInfo,
        );
        this.proxy.$resolveCustomTextEditor(viewType, uri.codeUri, webviewPanelId, cancellationToken);
      }
    }
  }

  $registerCustomEditor(
    viewType: string,
    editorType: CustomEditorType,
    options: ICustomEditorOptions = {},
    extensionInfo: IExtensionInfo,
  ) {
    this.customEditors.set(viewType, {
      type: editorType,
      options,
      extensionInfo,
    });
    this.eventBus.fire(
      new CustomEditorOptionChangeEvent({
        viewType,
        options,
      }),
    );
  }

  $unregisterCustomEditor(viewType: string) {
    this.customEditors.delete(viewType);
  }
}
