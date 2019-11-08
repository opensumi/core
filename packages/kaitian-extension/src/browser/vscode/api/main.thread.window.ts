import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadWindow, IExtHostWindow, IExtOpenDialogOptions } from '../../../common/vscode';
import { Optional, Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { isElectronRenderer, URI } from '@ali/ide-core-browser';
import { IDialogService, IWindowDialogService, IOpenDialogOptions } from '@ali/ide-overlay';

@Injectable({multiple: true})
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

  async $showOpenDialog(id: string, options: IExtOpenDialogOptions): Promise<void> {
    // TODO 这段逻辑单独放一个服务里面
    const op: IOpenDialogOptions = {
      ...options,
      defaultUri: options.defaultUri ? URI.from(options.defaultUri) : undefined,
    };
    const res = await this.windowDialogService.showOpenDialog(op);
    this.proxy.$onOpenDialogResult(id, res ? res.map((r) => r.codeUri) : res);
  }

  dispose() {

  }
}
