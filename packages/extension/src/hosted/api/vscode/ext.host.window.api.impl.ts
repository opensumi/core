import type vscode from 'vscode';
import {
  IExtHostMessage,
  IExtHostTreeView,
  TreeViewOptions,
  ViewColumn,
  IWebviewPanelOptions,
  IWebviewOptions,
  WebviewPanel,
  WebviewPanelSerializer,
  IExtHostWindowState,
  IExtHostStatusBar,
  IExtHostQuickOpen,
  IExtHostOutput,
  IExtHostTerminal,
  IExtHostWindow,
  IMainThreadWindow,
  MainThreadAPIIdentifier,
  IExtOpenDialogOptions,
  IExtSaveDialogOptions,
  IExtHostUrls,
  WebviewViewProvider,
} from '../../../common/vscode';
import { MessageType, IDisposable, CancellationToken, Emitter, IExtensionInfo } from '@opensumi/ide-core-common';
import { ExtensionHostEditorService } from './editor/editor.host';
import { ExtHostWebviewService, ExtHostWebviewViews } from './ext.host.api.webview';
import * as types from '../../../common/vscode/ext-types';
import { Uri } from '../../../common/vscode/ext-types';
import { IExtHostDecorationsShape } from '../../../common/vscode/decoration';
import { throwProposedApiError, IExtensionDescription } from '../../../common/vscode/extension';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { ExtHostProgress } from './ext.host.progress';
import { QuickInputOptions } from '@opensumi/ide-quick-open';
import { ExtHostTheming } from './ext.host.theming';
import { ExtHostCustomEditorImpl } from './ext.host.custom-editor';

export function createWindowApiFactory(
  extension: IExtensionDescription,
  extHostEditors: ExtensionHostEditorService,
  extHostMessage: IExtHostMessage,
  extHostWebviews: ExtHostWebviewService,
  extHostWebviewView: ExtHostWebviewViews,
  extHostTreeView: IExtHostTreeView,
  extHostWindowState: IExtHostWindowState,
  extHostDecorations: IExtHostDecorationsShape,
  extHostStatusBar: IExtHostStatusBar,
  extHostQuickOpen: IExtHostQuickOpen,
  extHostOutput: IExtHostOutput,
  extHostTerminal: IExtHostTerminal,
  extHostWindow: ExtHostWindow,
  extHostProgress: ExtHostProgress,
  extHostUrls: IExtHostUrls,
  extHostTheming: ExtHostTheming,
  extHostCustomEditor: ExtHostCustomEditorImpl,
): typeof vscode.window {
  const extensionInfo: IExtensionInfo = {
    id: extension.id,
    extensionId: extension.extensionId,
    isBuiltin: extension.isBuiltin,
  };
  return {
    // @deprecated
    withScmProgress<R>(task: (progress: vscode.Progress<number>) => Thenable<R>) {
      return extHostProgress.withProgress(
        extension,
        { location: types.ProgressLocation.SourceControl },
        (progress, token) =>
          task({
            report(n: number) {
              /* noop*/
            },
          }),
      );
    },
    withProgress<R>(
      options: vscode.ProgressOptions,
      task: (
        progress: vscode.Progress<{ message?: string; worked?: number }>,
        token: vscode.CancellationToken,
      ) => Thenable<R>,
    ) {
      if (typeof options.location === 'object') {
        throwProposedApiError(extension);
      }
      return extHostProgress.withProgress(extension, options, task);
    },
    createStatusBarItem(
      alignmentOrId?: vscode.StatusBarAlignment | string,
      priorityOrAlignment?: number | vscode.StatusBarAlignment,
      priorityArg?: number,
    ): vscode.StatusBarItem {
      let id: string | undefined;
      let alignment: number | undefined;
      let priority: number | undefined;

      if (typeof alignmentOrId === 'string') {
        id = alignmentOrId;
        alignment = priorityOrAlignment;
        priority = priorityArg;
      } else {
        alignment = alignmentOrId;
        priority = priorityOrAlignment;
      }
      return extHostStatusBar.createStatusBarItem(extension, id, alignment, priority);
    },
    createOutputChannel(name) {
      return extHostOutput.createOutputChannel(name);
    },
    setStatusBarMessage(text: string, arg?: number | Thenable<any>): vscode.Disposable {
      // step2
      return extHostStatusBar.setStatusBarMessage(text, arg);
    },
    showInformationMessage(
      message: string,
      first: vscode.MessageOptions | string | vscode.MessageItem,
      ...rest: (string | vscode.MessageItem)[]
    ) {
      return extHostMessage.showMessage(
        MessageType.Info,
        message,
        first,
        extension.displayName || extension.name,
        ...rest,
      );
    },
    showWarningMessage(
      message: string,
      first: vscode.MessageOptions | string | vscode.MessageItem,
      ...rest: Array<string | vscode.MessageItem>
    ) {
      return extHostMessage.showMessage(
        MessageType.Warning,
        message,
        first,
        extension.displayName || extension.name,
        ...rest,
      );
    },
    showErrorMessage(
      message: string,
      first: vscode.MessageOptions | string | vscode.MessageItem,
      ...rest: Array<string | vscode.MessageItem>
    ) {
      return extHostMessage.showMessage(
        MessageType.Error,
        message,
        first,
        extension.displayName || extension.name,
        ...rest,
      );
    },
    registerTreeDataProvider<T>(viewId: string, treeDataProvider: vscode.TreeDataProvider<T>) {
      return extHostTreeView.registerTreeDataProvider(viewId, treeDataProvider);
    },
    createTreeView<T>(viewId: string, options: TreeViewOptions<T>) {
      return extHostTreeView.createTreeView(viewId, options);
    },
    get activeTextEditor() {
      return extHostEditors.activeEditor && extHostEditors.activeEditor.textEditor;
    },
    get visibleTextEditors() {
      return extHostEditors.visibleEditors;
    },
    onDidChangeActiveTextEditor: extHostEditors.onDidChangeActiveTextEditor,
    onDidChangeVisibleTextEditors: extHostEditors.onDidChangeVisibleTextEditors,
    onDidChangeTextEditorSelection: extHostEditors.onDidChangeTextEditorSelection,
    onDidChangeTextEditorVisibleRanges: extHostEditors.onDidChangeTextEditorVisibleRanges,
    onDidChangeTextEditorOptions: extHostEditors.onDidChangeTextEditorOptions,
    onDidChangeTextEditorViewColumn: extHostEditors.onDidChangeTextEditorViewColumn,
    showTextDocument(
      documentOrUri: vscode.TextDocument | Uri,
      columnOrOptions?: vscode.ViewColumn | vscode.TextDocumentShowOptions,
      preserveFocus?: boolean,
    ) {
      return extHostEditors.showTextDocument(documentOrUri, columnOrOptions, preserveFocus);
    },
    createTextEditorDecorationType(options: vscode.DecorationRenderOptions) {
      return extHostEditors.createTextEditorDecorationType(extension.id, options);
    },
    showQuickPick(items: any, options: vscode.QuickPickOptions, token?: CancellationToken): any {
      return extHostQuickOpen.showQuickPick(items, options, token);
    },
    showWorkspaceFolderPick(options: vscode.WorkspaceFolderPickOptions): Promise<vscode.WorkspaceFolder | undefined> {
      return extHostQuickOpen.showWorkspaceFolderPick(options);
    },
    createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
      return extHostQuickOpen.createQuickPick();
    },
    showInputBox(options?: QuickInputOptions, token?: CancellationToken): PromiseLike<string | undefined> {
      return extHostQuickOpen.showInputBox(options, token);
    },
    createInputBox(): vscode.InputBox {
      return extHostQuickOpen.createInputBox();
    },
    createWebviewPanel(
      viewType: string,
      title: string,
      showOptions: ViewColumn | { preserveFocus: boolean; viewColumn: ViewColumn },
      options?: IWebviewPanelOptions & IWebviewOptions,
    ): WebviewPanel {
      return extHostWebviews.createWebview(
        Uri.parse('not-implemented://'),
        viewType,
        title,
        showOptions,
        options,
        extensionInfo,
      );
    },
    registerWebviewPanelSerializer(viewType: string, serializer: WebviewPanelSerializer): IDisposable {
      return extHostWebviews.registerWebviewPanelSerializer(viewType, serializer);
    },
    /**
     * @deprecated
     * proposed api registerDecorationProvider
     * please use registerFileDecorationProvider
     */
    registerDecorationProvider: proposedApiFunction(extension, (provider: vscode.DecorationProvider) =>
      extHostDecorations.registerFileDecorationProvider(provider, extension.id),
    ),
    registerFileDecorationProvider: (provider: vscode.FileDecorationProvider) =>
      extHostDecorations.registerFileDecorationProvider(provider, extension.id),
    registerUriHandler(handler: vscode.UriHandler) {
      return extHostUrls.registerUriHandler(extension.id, handler);
    },
    showOpenDialog: (options: vscode.OpenDialogOptions) => extHostWindow.openDialog(options),
    showSaveDialog: (options) => extHostWindow.showSaveDialog(options),

    get onDidChangeWindowState() {
      return extHostWindowState.onDidChangeWindowState;
    },

    get state() {
      return extHostWindowState.state;
    },

    /**
     * Terminal
     */
    get activeTerminal() {
      return extHostTerminal.activeTerminal;
    },

    get terminals() {
      return extHostTerminal.terminals;
    },

    onDidChangeActiveTerminal: extHostTerminal.onDidChangeActiveTerminal,

    onDidCloseTerminal: extHostTerminal.onDidCloseTerminal,

    onDidOpenTerminal: extHostTerminal.onDidOpenTerminal,

    createTerminal(
      nameOrOptions?: vscode.TerminalOptions | vscode.ExtensionTerminalOptions | string,
      shellPath?: string,
      shellArgs?: string[] | string,
    ): vscode.Terminal {
      if (typeof nameOrOptions === 'object') {
        if ('pty' in nameOrOptions) {
          return extHostTerminal.createExtensionTerminal(nameOrOptions);
        }
        return extHostTerminal.createTerminalFromOptions(nameOrOptions);
      }
      return extHostTerminal.createTerminal(nameOrOptions, shellPath, shellArgs);
    },

    get activeColorTheme(): vscode.ColorTheme {
      return extHostTheming.activeColorTheme;
    },

    onDidChangeActiveColorTheme(listener, thisArg?, disposables?) {
      return extHostTheming.onDidChangeActiveColorTheme(listener, thisArg, disposables);
    },
    registerCustomEditorProvider(
      viewType: string,
      provider: vscode.CustomTextEditorProvider | vscode.CustomEditorProvider | vscode.CustomReadonlyEditorProvider,
      options: { supportsMultipleEditorsPerDocument?: boolean; webviewOptions?: vscode.WebviewPanelOptions } = {},
    ): IDisposable {
      return extHostCustomEditor.registerCustomEditorProvider(viewType, provider, options, extensionInfo);
    },
    registerTerminalLinkProvider(handler: vscode.TerminalLinkProvider): vscode.Disposable {
      return extHostTerminal.registerLinkProvider(handler);
    },
    registerTerminalProfileProvider(id: string, provider: vscode.TerminalProfileProvider): vscode.Disposable {
      return extHostTerminal.registerTerminalProfileProvider(extension, id, provider);
    },
    registerWebviewViewProvider(
      viewId: string,
      provider: WebviewViewProvider,
      options?: { webviewOptions: { retainContextWhenHidden: boolean } },
    ) {
      return extHostWebviewView.registerWebviewViewProvider(extension, viewId, provider, options?.webviewOptions);
    },
  };
}

function proposedApiFunction<T>(extension: IExtensionDescription, fn: T): T {
  if (extension.enableProposedApi) {
    return fn;
  } else {
    return throwProposedApiError.bind(null, extension) as any as T;
  }
}

export class ExtHostWindow implements IExtHostWindow {
  protected readonly proxy: IMainThreadWindow;

  private id = 0;
  private _onOpenedResult = new Emitter<{ id: string; result: types.UriComponents[] | undefined }>();
  private _onSavedResult = new Emitter<{ id: string; result: types.UriComponents | undefined }>();
  constructor(rpcProtocol: IRPCProtocol) {
    this.proxy = rpcProtocol.getProxy(MainThreadAPIIdentifier.MainThreadWindow);
  }

  openDialog(options: IExtOpenDialogOptions): Promise<types.Uri[] | undefined> {
    return new Promise<types.Uri[] | undefined>((resolve) => {
      const id = (this.id++).toString();
      this.proxy.$showOpenDialog(id, options);
      const disposer = this._onOpenedResult.event((res) => {
        if (res.id === id) {
          disposer.dispose();
          resolve(res.result ? res.result.map((r) => Uri.revive(r)) : undefined);
        }
      });
    });
  }

  showSaveDialog(options: IExtSaveDialogOptions): Promise<types.Uri | undefined> {
    return new Promise<types.Uri | undefined>((resolve) => {
      const id = (this.id++).toString();
      this.proxy.$showSaveDialog(id, options);
      const disposer = this._onSavedResult.event((res) => {
        if (res.id === id) {
          disposer.dispose();
          resolve(res.result ? Uri.revive(res.result) : undefined);
        }
      });
    });
  }

  $onOpenDialogResult(id: string, result: types.UriComponents[] | undefined): void {
    this._onOpenedResult.fire({ id, result });
  }

  $onSaveDialogResult(id: string, result: types.UriComponents | undefined): void {
    this._onSavedResult.fire({ id, result });
  }
}
