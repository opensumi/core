import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar } from '../../common';
import { Disposable } from '../../common/ext-types';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, CommandService } from '@ali/ide-core-browser';
import { StatusBarService, StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

@Injectable()
export class MainThreadStatusBar implements IMainThreadStatusBar {

  private readonly proxy: IExtHostStatusBar;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(StatusBar)
  statusBar: StatusBar;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostStatusBar);
  }

  $setStatusBarMessage(text: string): void {

    this.statusBar.addElement('statusbar_text', {
      text,
      alignment: StatusBarAlignment.LEFT,
    });
  }

  $dispose(): void {

    this.statusBar.removeElement('statusbar_text');

  }

}
