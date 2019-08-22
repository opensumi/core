import { IExtHostCommands } from '../../../common/vscode';

export function createLayoutAPIFactory(
  extHostCommands: IExtHostCommands,
) {
  return {
    toggleBottomPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.toggle');
    },
  };
}
