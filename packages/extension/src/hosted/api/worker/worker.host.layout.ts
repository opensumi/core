import { ExtHostCommands } from '../vscode/ext.host.command';

export function createLayoutAPIFactory(extHostCommands: ExtHostCommands) {
  return {
    toggleBottomPanel: async () => await extHostCommands.executeCommand('main-layout.bottom-panel.toggle'),
  };
}
