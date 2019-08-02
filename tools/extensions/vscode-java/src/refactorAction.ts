'use strict';

import { commands, window, ExtensionContext, workspace, Position, Uri, TextDocument } from 'vscode';
import { LanguageClient, FormattingOptions } from 'vscode-languageclient';
import { Commands as javaCommands } from './commands';
import { GetRefactorEditRequest, RefactorWorkspaceEdit, RenamePosition } from './protocol';

export function registerCommands(languageClient: LanguageClient, context: ExtensionContext) {
    registerApplyRefactorCommand(languageClient, context);
}

function registerApplyRefactorCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(javaCommands.RENAME_COMMAND, async (position: RenamePosition) => {
        try {
            const uri: Uri = Uri.parse(position.uri);
            const document: TextDocument = await workspace.openTextDocument(uri);
            if (document == null) {
                return;
            }

            const renamePosition: Position = document.positionAt(position.offset);
            await commands.executeCommand('editor.action.rename', [
                document.uri,
                renamePosition,
            ]);
        } catch (error) {
            // do nothing.
        }
    }));

    context.subscriptions.push(commands.registerCommand(javaCommands.APPLY_REFACTORING_COMMAND, async (command: string, params: any, commandInfo: any) => {
        if (command === 'extractVariable'
            || command === 'extractVariableAllOccurrence'
            || command === 'extractConstant'
            || command === 'extractMethod'
            || command === 'extractField'
            || command === 'convertVariableToField') {
            const currentEditor = window.activeTextEditor;
            if (!currentEditor || !currentEditor.options) {
                return;
            }

            const formattingOptions: FormattingOptions = {
                tabSize: <number> currentEditor.options.tabSize,
                insertSpaces: <boolean> currentEditor.options.insertSpaces,
            };
            const commandArguments: any[] = [];
            if (command === 'extractField' || command === 'convertVariableToField') {
                if (commandInfo.initializedScopes && Array.isArray(commandInfo.initializedScopes)) {
                    const scopes: any[] = commandInfo.initializedScopes;
                    let initializeIn: string;
                    if (scopes.length === 1) {
                        initializeIn = scopes[0];
                    } else if (scopes.length > 1) {
                        initializeIn = await window.showQuickPick(scopes, {
                            placeHolder: "Initialize the field in",
                        });

                        if (!initializeIn) {
                            return;
                        }
                    }

                    commandArguments.push(initializeIn);
                }
            }

            const result: RefactorWorkspaceEdit = await languageClient.sendRequest(GetRefactorEditRequest.type, {
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
                await workspace.applyEdit(edit);
            }
            
            if (result.command) {
                if (result.command.arguments) {
                    await commands.executeCommand(result.command.command, ...result.command.arguments);
                } else {
                    await commands.executeCommand(result.command.command);
                }
            }
        }
    }));
}
