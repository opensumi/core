import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar } from '../../common';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { CommandRegistry, ILogger, CommandService } from '@ali/ide-core-browser';
import { StatusBarService, StatusBar, StatusBarAlignment, StatusBarEntry } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import * as types from '../../common/ext-types';

@Injectable()
export class MainThreadStatusBar implements IMainThreadStatusBar {
  private entries: Map<string, StatusBarEntry> = new Map();

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

    this.statusBar.addElement('ext_default_statusbar_text', {
      text,
      alignment: StatusBarAlignment.LEFT,
    });
  }

  $dispose(id?: string): void {
    if (id) {
      this.statusBar.removeElement(id);
    } else {

      this.statusBar.removeElement('ext_default_statusbar_text');
    }
  }

  $createStatusBarItem(id: string, alignment: number, priority: number) {
    this.statusBar.addElement(id, {
      alignment,
      priority,
    });
  }

  async $setMessage(id: string,
                    text: string | undefined,
                    priority: number,
                    alignment: number,
                    color: string | undefined,
                    tooltip: string | undefined,
                    command: string | undefined): Promise<void> {
    const entry = {
        text: text || '',
        priority,
        alignment: alignment === types.StatusBarAlignment.Left ? StatusBarAlignment.LEFT : StatusBarAlignment.RIGHT,
        color,
        tooltip,
        command,
    };

    this.entries.set(id, entry);
    await this.statusBar.addElement(id, entry);
  }

}
