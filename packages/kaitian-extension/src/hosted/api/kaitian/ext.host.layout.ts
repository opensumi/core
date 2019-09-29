import { IExtHostCommands } from '../../../common/vscode';

export function createLayoutAPIFactory(
  extHostCommands: IExtHostCommands,
) {
  return {
    toggleBottomPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.toggle');
    },
    toggleLeftPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.left-panel.toggle');
    },
    toggleRightPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.right-panel.toggle');
    },
    showRightPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.right-panel.show');
    },
    hideRightPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.right-panel.hide');
    },
    activatePanel: async (id) => {
      return await extHostCommands.executeCommand(`activity.panel.activate.${id}`);
    },
  };
}
