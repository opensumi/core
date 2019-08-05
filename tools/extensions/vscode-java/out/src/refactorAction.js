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
const protocol_1 = require("./protocol");
function registerCommands(languageClient, context) {
    registerApplyRefactorCommand(languageClient, context);
}
exports.registerCommands = registerCommands;
function registerApplyRefactorCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.RENAME_COMMAND, (position) => __awaiter(this, void 0, void 0, function* () {
        try {
            const uri = vscode_1.Uri.parse(position.uri);
            const document = yield vscode_1.workspace.openTextDocument(uri);
            if (document == null) {
                return;
            }
            const renamePosition = document.positionAt(position.offset);
            yield vscode_1.commands.executeCommand('editor.action.rename', [
                document.uri,
                renamePosition,
            ]);
        }
        catch (error) {
            // do nothing.
        }
    })));
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.APPLY_REFACTORING_COMMAND, (command, params, commandInfo) => __awaiter(this, void 0, void 0, function* () {
        if (command === 'extractVariable'
            || command === 'extractVariableAllOccurrence'
            || command === 'extractConstant'
            || command === 'extractMethod'
            || command === 'extractField'
            || command === 'convertVariableToField') {
            const currentEditor = vscode_1.window.activeTextEditor;
            if (!currentEditor || !currentEditor.options) {
                return;
            }
            const formattingOptions = {
                tabSize: currentEditor.options.tabSize,
                insertSpaces: currentEditor.options.insertSpaces,
            };
            const commandArguments = [];
            if (command === 'extractField' || command === 'convertVariableToField') {
                if (commandInfo.initializedScopes && Array.isArray(commandInfo.initializedScopes)) {
                    const scopes = commandInfo.initializedScopes;
                    let initializeIn;
                    if (scopes.length === 1) {
                        initializeIn = scopes[0];
                    }
                    else if (scopes.length > 1) {
                        initializeIn = yield vscode_1.window.showQuickPick(scopes, {
                            placeHolder: "Initialize the field in",
                        });
                        if (!initializeIn) {
                            return;
                        }
                    }
                    commandArguments.push(initializeIn);
                }
            }
            const result = yield languageClient.sendRequest(protocol_1.GetRefactorEditRequest.type, {
                command,
                context: params,
                options: formattingOptions,
                commandArguments,
            });
            if (!result || !result.edit) {
                return;
            }
            const edit = languageClient.protocol2CodeConverter.asWorkspaceEdit(result.edit);
            if (edit) {
                yield vscode_1.workspace.applyEdit(edit);
            }
            if (result.command) {
                if (result.command.arguments) {
                    yield vscode_1.commands.executeCommand(result.command.command, ...result.command.arguments);
                }
                else {
                    yield vscode_1.commands.executeCommand(result.command.command);
                }
            }
        }
    })));
}
//# sourceMappingURL=refactorAction.js.map