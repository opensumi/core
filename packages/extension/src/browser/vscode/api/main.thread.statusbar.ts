import { Injectable, Autowired, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { CommandService, Disposable, IAccessibilityInformation } from '@opensumi/ide-core-browser';
import { IStatusBarService, StatusBarAlignment, StatusBarEntry } from '@opensumi/ide-core-browser/lib/services';
import { IMarkdownString, IThemeColor } from '@opensumi/ide-core-common';
import { getCodiconAriaLabel } from '@opensumi/monaco-editor-core/esm/vs/base/common/codicons';

import { ExtHostAPIIdentifier, IMainThreadStatusBar, IExtHostStatusBar } from '../../../common/vscode';
import * as types from '../../../common/vscode/ext-types';

@Injectable({ multiple: true })
export class MainThreadStatusBar implements IMainThreadStatusBar {
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
    this.disposable.addDispose(
      this.statusBar.addElement('ext_default_statusbar_text', {
        text,
        alignment: StatusBarAlignment.LEFT,
      }),
    );
  }

  $dispose(entryId?: string): void {
    if (entryId) {
      this.statusBar.removeElement(entryId);
    } else {
      this.statusBar.removeElement('ext_default_statusbar_text');
    }
  }

  $createStatusBarItem(entryId: string, id: string, alignment: number, priority: number) {
    this.disposable.addDispose(
      this.statusBar.addElement(entryId, {
        id,
        alignment,
        priority,
      }),
    );
  }

  async $setMessage(
    entryId: string,
    id: string,
    name: string,
    text: string | undefined,
    priority: number,
    alignment: number,
    color: IThemeColor | string | undefined,
    backgroundColor: IThemeColor | string | undefined,
    tooltip: string | IMarkdownString | undefined,
    accessibilityInformation: IAccessibilityInformation | undefined,
    command: string | undefined,
    commandArgs: any[] | undefined,
  ): Promise<void> {
    const ariaLabel = accessibilityInformation?.label || getCodiconAriaLabel(text);
    const entry: StatusBarEntry = {
      id,
      name,
      text: text || '',
      priority,
      alignment: alignment === types.StatusBarAlignment.Left ? StatusBarAlignment.LEFT : StatusBarAlignment.RIGHT,
      color,
      backgroundColor,
      tooltip,
      command,
      arguments: commandArgs,
      role: accessibilityInformation?.role,
      ariaLabel,
    };

    this.disposable.addDispose(this.statusBar.addElement(entryId, entry));
  }
}
