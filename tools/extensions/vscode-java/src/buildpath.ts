'use strict';

import { window, commands, ExtensionContext, Uri } from 'vscode';
import { Commands } from './commands';

interface Result {
    status: boolean;
    message: string;
}

interface SourcePath {
    path: string;
    displayPath: string;
    projectName: string;
    projectType: string;
}

interface ListCommandResult extends Result {
    data?: SourcePath[];
}

export function registerCommands(context: ExtensionContext) {
    context.subscriptions.push(commands.registerCommand(Commands.ADD_TO_SOURCEPATH, async (uri: Uri) => {
        const result = await <any>commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.ADD_TO_SOURCEPATH, uri.toString());
        if (result.status) {
            window.showInformationMessage(result.message ? result.message : 'Successfully added the folder to the source path.');
        } else {
            window.showErrorMessage(result.message);
        }
    }));

    context.subscriptions.push(commands.registerCommand(Commands.REMOVE_FROM_SOURCEPATH, async (uri: Uri) => {
        const result = await <any>commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.REMOVE_FROM_SOURCEPATH, uri.toString());
        if (result.status) {
            window.showInformationMessage(result.message ? result.message : 'Successfully removed the folder from the source path.');
        } else {
            window.showErrorMessage(result.message);
        }
    }));

    context.subscriptions.push(commands.registerCommand(Commands.LIST_SOURCEPATHS, async() => {
        const result: ListCommandResult = await commands.executeCommand<ListCommandResult>(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.LIST_SOURCEPATHS);
        if (result.status) {
            if (!result.data || !result.data.length) {
                window.showInformationMessage("No Java source directories found in the workspace, please use the command 'Add Folder to Java Source Path' first.");
            } else {
                window.showQuickPick(result.data.map(sourcePath => {
                    return {
                        label: sourcePath.displayPath,
                        detail: `$(file-directory) ${sourcePath.projectType} Project: ${sourcePath.projectName}`,
                    };
                }), { placeHolder: 'All Java source directories recognized by the workspace.'});
            }
        } else {
            window.showErrorMessage(result.message);
        }
    }));
}
