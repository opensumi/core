import * as React from 'react';
import { IWindowDialogService, IOpenDialogOptions, IDialogService, ISaveDialogOptions } from '@ali/ide-overlay';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronRenderer, electronEnv, URI, MessageType } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { FileDialog } from './file-dialog.view';
import { FileTreeDialogModel } from './file-dialog-model.service';
import { FileTreeDialogService } from './file-dialog.service';
import { isMacintosh } from '@ali/ide-core-common/lib/platform';
import { IFileServiceClient } from '@ali/ide-file-service';

@Injectable()
export class WindowDialogServiceImpl implements IWindowDialogService {

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  private _userHome: URI;
  private _whenReady: Promise<void>;

  constructor() {
    this._whenReady = this.init();
  }

  async init() {
    const userHome = await this.fileServiceClient.getCurrentUserHome();
    if (userHome) {
      this._userHome = new URI(userHome.uri);
    }
  }

  get userHome() {
    return this._userHome;
  }

  get whenReady() {
    return this._whenReady;
  }

  // https://code.visualstudio.com/api/references/vscode-api#OpenDialogOptions
  async showOpenDialog(options: IOpenDialogOptions = {}): Promise<URI[] | undefined> {
    await this.whenReady;
    const defaultOptions: IOpenDialogOptions = {
      canSelectFiles: true,
      canSelectFolders: false,
      canSelectMany: false,
    };
    if (isElectronRenderer()) {
      // TODO 非file协议OpenDialog
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const properties: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles' | 'createDirectory' | 'promptToCreate' | 'noResolveAliases' | 'treatPackageAsDirectory'> = [];
      if (options.canSelectFiles) {
        properties.push('openFile');
      }
      if (options.canSelectFolders) {
        properties.push('openDirectory');
      }
      if (options.canSelectMany) {
        properties.push('multiSelections');
      }

      if (isMacintosh) {
        // macOS - Treat packages, such as .app folders, as a directory instead of a file.
        properties.push('treatPackageAsDirectory');
      }
      const defaultUri = options.defaultUri || this.userHome;
      const res = await electronUi.showOpenDialog(electronEnv.currentWindowId, {
        defaultPath: defaultUri.codeUri.fsPath,
        title: options.openLabel,
        properties,
      });
      if (res && res.length > 0) {
        return res.map((r) => URI.file(r));
      } else {
        return undefined;
      }
    } else {
      const defaultUri = options.defaultUri || this.userHome;
      let fileTreeDialogService: FileTreeDialogService;
      if (defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [defaultUri?.toString()]);
      } else {
        fileTreeDialogService = this.injector.get(FileTreeDialogService);
      }
      const model = FileTreeDialogModel.createModel(this.injector, fileTreeDialogService);
      const res = await this.dialogService.open<string[]>(<FileDialog model={model} options={{ ...defaultOptions, ...options}} isOpenDialog={true}/>, MessageType.Empty);
      if (res && res.length > 0) {
        return res.map((r) => URI.file(r));
      } else {
        return undefined;
      }
    }
  }

  // https://code.visualstudio.com/api/references/vscode-api#SaveDialogOptions
  async showSaveDialog(options: ISaveDialogOptions = {}): Promise<URI | undefined> {
    await this.whenReady;
    if (isElectronRenderer()) {
      // TODO 非file协议SaveDialog
      const defaultUri = options.defaultUri || this.userHome;
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const res = await electronUi.showSaveDialog(electronEnv.currentWindowId, {
        defaultPath: defaultUri.resolve(options.defaultFileName || '').codeUri.fsPath,
        title: options.saveLabel,
        message: options.saveLabel,
      });
      if (res) {
        return URI.file(res);
      } else {
        return undefined;
      }
    } else {
      const defaultUri = options.defaultUri || this.userHome;
      let fileTreeDialogService: FileTreeDialogService;
      if (defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [defaultUri?.toString()]);
      } else {
        fileTreeDialogService = this.injector.get(FileTreeDialogService);
      }
      const model = FileTreeDialogModel.createModel(this.injector, fileTreeDialogService);
      const res = await this.dialogService.open<string[]>(<FileDialog model={model} options={options} isOpenDialog={false}/>, MessageType.Empty);
      if (res && res.length > 0) {
        return URI.file(res[0]);
      } else {
        return undefined;
      }
    }
  }

}
