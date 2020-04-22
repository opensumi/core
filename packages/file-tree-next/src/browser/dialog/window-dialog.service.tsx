import * as React from 'react';
import { IWindowDialogService, IOpenDialogOptions, IDialogService, ISaveDialogOptions } from '@ali/ide-overlay';
import { Injectable, Injector, Autowired, INJECTOR_TOKEN } from '@ali/common-di';
import { isElectronRenderer, electronEnv, URI, MessageType } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { FileDialog } from './file-dialog.view';
import { FileTreeDialogModel } from './file-dialog-model.service';
import { FileTreeDialogService } from './file-dialog.service';

@Injectable()
export class WindowDialogServiceImpl implements IWindowDialogService {

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  // https://code.visualstudio.com/api/references/vscode-api#OpenDialogOptions
  async showOpenDialog(options: IOpenDialogOptions): Promise<URI[] | undefined> {
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
      const res = await electronUi.showOpenDialog(electronEnv.currentWindowId, {
        defaultPath: options.defaultUri ? options.defaultUri.codeUri.fsPath : 'undefined',
        title: options.openLabel,
        properties,
      });
      if (res && res.length > 0) {
        return res.map((r) => URI.file(r));
      } else {
        return undefined;
      }
    } else {
      const defaultUri = options.defaultUri;
      let fileTreeDialogService: FileTreeDialogService;
      if (defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [defaultUri?.toString()]);
      } else {
        fileTreeDialogService = this.injector.get(FileTreeDialogService);
      }
      const model = FileTreeDialogModel.createModel(this.injector, fileTreeDialogService);
      const res = await this.dialogService.open<string[]>(<FileDialog model={model} options={{ ...defaultOptions, ...options}} isOpenDialog={false}/>, MessageType.Empty);
      if (res && res.length > 0) {
        return res.map((r) => URI.file(r));
      } else {
        return undefined;
      }
    }
  }

  // https://code.visualstudio.com/api/references/vscode-api#SaveDialogOptions
  async showSaveDialog(options: ISaveDialogOptions = {}): Promise<URI | undefined> {
    if (isElectronRenderer()) {
      // TODO 非file协议SaveDialog
      const electronUi = this.injector.get(IElectronMainUIService) as IElectronMainUIService;
      const res = await electronUi.showSaveDialog(electronEnv.currentWindowId, {
        defaultPath: (options.defaultUri ? options.defaultUri.codeUri.fsPath : '') + '/' + (options.defaultFileName || ''),
        title: options.saveLabel,
        message: options.saveLabel,
      });
      if (res) {
        return URI.file(res);
      } else {
        return undefined;
      }
    } else {
      const defaultUri = options.defaultUri;
      let fileTreeDialogService: FileTreeDialogService;
      if (defaultUri) {
        fileTreeDialogService = this.injector.get(FileTreeDialogService, [defaultUri?.path.toString()]);
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
