import { IRPCProtocol } from '@ali/ide-connection';
import { IMainThreadStatusBar } from '../../../common/vscode';
import { Injectable, Autowired, Optinal } from '@ali/common-di';
import { ILogger, CommandService, Disposable } from '@ali/ide-core-browser';
import { IStatusBarService, StatusBarAlignment, StatusBarEntry } from '@ali/ide-core-browser/lib/services';
import * as types from '../../../common/vscode/ext-types';

@Injectable({multiple: true})
export class MainThreadStatusBar implements IMainThreadStatusBar {
  private entries: Map<string, StatusBarEntry> = new Map();

  private disposable = new Disposable();

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  @Autowired(ILogger)
  logger: ILogger;

  constructor(@Optinal(Symbol()) rpcProtocol: IRPCProtocol) {
  }

  public dispose() {
    this.disposable.dispose();
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
    this.disposable.addDispose( this.statusBar.addElement(id, {
      alignment,
      priority,
    }));
  }

  async $setMessage(id: string,
                    text: string | undefined,
                    priority: number,
                    alignment: number,
                    color: string | undefined,
                    tooltip: string | undefined,
                    command: string | undefined,
                    commandArgs: any[] | undefined): Promise<void> {
    const entry: StatusBarEntry = {
        text: text || '',
        priority,
        alignment: alignment === types.StatusBarAlignment.Left ? StatusBarAlignment.LEFT : StatusBarAlignment.RIGHT,
        color,
        tooltip,
        command,
        arguments: commandArgs,
    };

    this.entries.set(id, entry);
    await this.statusBar.addElement(id, entry);
  }

}
