import React from 'react';

import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import {
  isElectronRenderer,
  electronEnv,
  URI,
  MessageType,
  StorageProvider,
  IStorage,
  STORAGE_NAMESPACE,
} from '@opensumi/ide-core-browser';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { isMacintosh } from '@opensumi/ide-core-common/lib/platform';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IWindowDialogService, IOpenDialogOptions, IDialogService, ISaveDialogOptions } from '@opensumi/ide-overlay';

import { FileTreeDialogModel } from './file-dialog-model.service';
import { FileTreeDialogService } from './file-dialog.service';
import { FileDialog } from './file-dialog.view';

@Injectable()
export class WindowDialogServiceImpl implements IWindowDialogService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(StorageProvider)
  private storageProvider: StorageProvider;

  private recentGlobalStorage: IStorage;

  private _userHome: URI;
  private _whenReady: Promise<void>;
  private _defaultUri: URI;

  constructor() {
    this._whenReady = this.init();
  }

  async init() {
    this.recentGlobalStorage = await this.storageProvider(STORAGE_NAMESPACE.GLOBAL_RECENT_DATA);
    const defaultUriStr = await this.recentGlobalStorage.get<string>('RECENT_DIALOG_DEFAULT_URI');
    if (!defaultUriStr) {
      const userHome = await this.fileServiceClient.getCurrentUserHome();
      this._defaultUri = new URI(userHome!.uri);
    } else {
      this._defaultUri = new URI(defaultUriStr);
    }
  }

  get defaultUri() {
    return this._defaultUri;
  }

  get whenReady() {
    return this._whenReady;
  }

  private async updateRecentDefaultUri(uri: URI) {
    this.recentGlobalStorage.set('RECENT_DIALOG_DEFAULT_URI', uri.toString());
    this._defaultUri = uri;
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
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const properties: Array<
        | 'openFile'
        | 'openDirectory'
        | 'multiSelections'
        | 'showHiddenFiles'
        | 'createDirectory'
        | 'promptToCreate'
        | 'noResolveAliases'
        | 'treatPackageAsDirectory'
      > = [];
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
        properties.push('treatPackageAsDirectory', 'createDirectory');
      }
      const defaultUri = options.defaultUri || this.defaultUri;
      const res = await electronUi.showOpenDialog(electronEnv.currentWindowId, {
        defaultPath: defaultUri.codeUri.fsPath,
        title: options.title,
        buttonLabel: options.openLabel,
        properties,
      });
      if (res && res.length > 0) {
        const files = res.map((r) => URI.file(r));
        this.updateRecentDefaultUri(files[0]);
        return files;
      } else {
        return undefined;
      }
    } else {
      if (!options.defaultUri) {
        options.defaultUri = this.defaultUri;
      }
      let fileTreeDialogService: FileTreeDialogService;
      if (options.defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [options.defaultUri!.toString()]);
      } else {
        fileTreeDialogService = this.injector.get(FileTreeDialogService);
      }
      await fileTreeDialogService.whenReady;
      const model = FileTreeDialogModel.createModel(this.injector, fileTreeDialogService);
      const res = await this.dialogService.open<string[]>(
        <FileDialog model={model} options={{ ...defaultOptions, ...options }} isOpenDialog={true} />,
        MessageType.Empty,
      );
      this.dialogService.reset();
      if (res && res.length > 0) {
        const files = res.map((r) => URI.file(r));
        this.updateRecentDefaultUri(files[0]);
        return files;
      } else {
        return undefined;
      }
    }
  }

  // https://code.visualstudio.com/api/references/vscode-api#SaveDialogOptions
  async showSaveDialog(options: ISaveDialogOptions = {}): Promise<URI | undefined> {
    await this.whenReady;
    if (isElectronRenderer()) {
      const defaultUri = options.defaultUri || this.defaultUri;
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const res = await electronUi.showSaveDialog(electronEnv.currentWindowId, {
        defaultPath: defaultUri.resolve(options.defaultFileName || '').codeUri.fsPath,
        title: options.saveLabel,
        message: options.saveLabel,
      });
      if (res) {
        const file = URI.file(res);
        // 保存文件的场景会有文件名，故更新默认路径为父路径
        this.updateRecentDefaultUri(file.parent);
        return file;
      } else {
        return undefined;
      }
    } else {
      if (!options.defaultUri) {
        options.defaultUri = this.defaultUri;
      }
      let fileTreeDialogService: FileTreeDialogService;
      if (options.defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [options.defaultUri!.toString()]);
      } else {
        fileTreeDialogService = this.injector.get(FileTreeDialogService);
      }
      await fileTreeDialogService.whenReady;
      const model = FileTreeDialogModel.createModel(this.injector, fileTreeDialogService);
      const res = await this.dialogService.open<string[]>(
        <FileDialog model={model} options={options} isOpenDialog={false} />,
        MessageType.Empty,
      );
      this.dialogService.reset();
      if (res && res.length > 0) {
        const file = URI.file(res[0]);
        // 保存文件的场景会有文件名，故更新默认路径为父路径
        this.updateRecentDefaultUri(file.parent);
        return file;
      } else {
        return undefined;
      }
    }
  }
}
