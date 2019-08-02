'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const commands_1 = require("./commands");
function registerCommands(context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.ADD_TO_SOURCEPATH, (uri) => __awaiter(this, void 0, void 0, function* () {
        const result = yield vscode_1.commands.executeCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, commands_1.Commands.ADD_TO_SOURCEPATH, uri.toString());
        if (result.status) {
            vscode_1.window.showInformationMessage(result.message ? result.message : 'Successfully added the folder to the source path.');
        }
        else {
            vscode_1.window.showErrorMessage(result.message);
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.REMOVE_FROM_SOURCEPATH, (uri) => __awaiter(this, void 0, void 0, function* () {
        const result = yield vscode_1.commands.executeCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, commands_1.Commands.REMOVE_FROM_SOURCEPATH, uri.toString());
        if (result.status) {
            vscode_1.window.showInformationMessage(result.message ? result.message : 'Successfully removed the folder from the source path.');
        }
        else {
            vscode_1.window.showErrorMessage(result.message);
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.LIST_SOURCEPATHS, () => __awaiter(this, void 0, void 0, function* () {
        const result = yield vscode_1.commands.executeCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, commands_1.Commands.LIST_SOURCEPATHS);
        if (result.status) {
            if (!result.data || !result.data.length) {
                vscode_1.window.showInformationMessage("No Java source directories found in the workspace, please use the command 'Add Folder to Java Source Path' first.");
            }
            else {
                vscode_1.window.showQuickPick(result.data.map(sourcePath => {
                    return {
                        label: sourcePath.displayPath,
                        detail: `$(file-directory) ${sourcePath.projectType} Project: ${sourcePath.projectName}`,
                    };
                }), { placeHolder: 'All Java source directories recognized by the workspace.' });
            }
        }
        else {
            vscode_1.window.showErrorMessage(result.message);
        }
    })));
}
exports.registerCommands = registerCommands;
//# sourceMappingURL=buildpath.js.map