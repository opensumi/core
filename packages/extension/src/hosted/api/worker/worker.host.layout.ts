import { ExtHostCommands } from '../vscode/ext.host.command';

export function createLayoutAPIFactory(
  extHostCommands: ExtHostCommands,
) {
  return {
    toggleBottomPanel: async () => {
      return await extHostCommands.executeCommand('main-layout.bottom-panel.toggle');
    },
  };
}
