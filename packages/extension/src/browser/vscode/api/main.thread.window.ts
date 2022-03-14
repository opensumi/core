import { Optional, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { URI } from '@opensumi/ide-core-browser';
import { IDialogService, IWindowDialogService, IOpenDialogOptions, ISaveDialogOptions } from '@opensumi/ide-overlay';

import {
  ExtHostAPIIdentifier,
  IMainThreadWindow,
  IExtHostWindow,
  IExtOpenDialogOptions,
  IExtSaveDialogOptions,
} from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadWindow implements IMainThreadWindow {
  private readonly proxy: IExtHostWindow;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IDialogService)
  dialogService: IDialogService;

  @Autowired(IWindowDialogService)
  windowDialogService: IWindowDialogService;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostWindow);
  }

  private getDefaultDialogOptions(options) {
    return {
      ...options,
      defaultUri: options.defaultUri ? URI.from(options.defaultUri) : undefined,
    };
  }

  async $showOpenDialog(id: string, options: IExtOpenDialogOptions = {}): Promise<void> {
    const op: IOpenDialogOptions = this.getDefaultDialogOptions(options);
    const res = await this.windowDialogService.showOpenDialog(op);
    this.proxy.$onOpenDialogResult(id, res ? res.map((r) => r.codeUri) : res);
  }

  async $showSaveDialog(id: string, options: IExtSaveDialogOptions = {}): Promise<void> {
    const op: ISaveDialogOptions = this.getDefaultDialogOptions(options);
    const res = await this.windowDialogService.showSaveDialog(op);
    this.proxy.$onSaveDialogResult(id, res ? res.codeUri : res);
  }

  dispose() {}
}
