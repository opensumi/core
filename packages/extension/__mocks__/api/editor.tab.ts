import { IMainThreadEditorTabsShape } from '../../lib/common/vscode';

export class MainThreadEditorTabsService implements IMainThreadEditorTabsShape {
  $initializeState(): void {}
  $moveTab(tabId: string, index: number, viewColumn: number, preserveFocus?: boolean | undefined): void {}
  async $closeTab(tabIds: string[], preserveFocus?: boolean | undefined): Promise<boolean> {
    return true;
  }
  async $closeGroup(groupIds: number[], preservceFocus?: boolean | undefined): Promise<boolean> {
    return true;
  }
  dispose(): void {}
}
