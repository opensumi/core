import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar } from '../../../common/vscode';
import { Injectable, Autowired, Optional } from '@ali/common-di';
import { CommandService, Disposable, IAccessibilityInformation } from '@ali/ide-core-browser';
import { IStatusBarService, StatusBarAlignment, StatusBarEntry } from '@ali/ide-core-browser/lib/services';
import * as types from '../../../common/vscode/ext-types';

@Injectable({multiple: true})
export class MainThreadStatusBar implements IMainThreadStatusBar {
  private entries: Map<string, StatusBarEntry> = new Map();

  private disposable = new Disposable();
  protected readonly proxy: IExtHostStatusBar;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostStatusBar);
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

  async $setMessage(
    id: string,
    text: string | undefined,
    priority: number,
    alignment: number,
    color: string | undefined,
    tooltip: string | undefined,
    accessibilityInformation: IAccessibilityInformation | undefined,
    command: string | undefined,
    commandArgs: any[] | undefined,
  ): Promise<void> {
    // TODO 下面正则可以升级 monaco 从 vs/base/common/codicons 导出
    const ariaLabel = accessibilityInformation?.label || text && text.replace(/\$\((.*?)\)/g, (_match, codiconName) => ` ${codiconName} `).trim();
    const entry: StatusBarEntry = {
        text: text || '',
        priority,
        alignment: alignment === types.StatusBarAlignment.Left ? StatusBarAlignment.LEFT : StatusBarAlignment.RIGHT,
        color,
        tooltip,
        command,
        arguments: commandArgs,
        role: accessibilityInformation?.role,
        ariaLabel,
    };

    this.entries.set(id, entry);
    await this.statusBar.addElement(id, entry);
  }

}
