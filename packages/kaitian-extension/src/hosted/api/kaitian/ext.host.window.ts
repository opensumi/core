import { IExtHostCommands } from '../../../common/vscode';

export function createWindowApiFactory(
    extHostCommands: IExtHostCommands,
) {
    return {
        reloadWindow: async () => {
            return await extHostCommands.executeCommand('reload_window');
        },
    };
}
