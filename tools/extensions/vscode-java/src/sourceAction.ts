'use strict';

import { commands, window, ExtensionContext, Range, ViewColumn, Uri, Disposable } from 'vscode';
import { CodeActionParams, LanguageClient } from 'vscode-languageclient';
import { Commands } from './commands';
import { applyWorkspaceEdit } from './extension';
import { ListOverridableMethodsRequest, AddOverridableMethodsRequest, CheckHashCodeEqualsStatusRequest, GenerateHashCodeEqualsRequest,
OrganizeImportsRequest, ImportCandidate, ImportSelection, GenerateToStringRequest, CheckToStringStatusRequest, VariableBinding, ResolveUnimplementedAccessorsRequest, GenerateAccessorsRequest, CheckConstructorStatusRequest, GenerateConstructorsRequest, CheckDelegateMethodsStatusRequest, GenerateDelegateMethodsRequest } from './protocol';

export function registerCommands(languageClient: LanguageClient, context: ExtensionContext) {
    registerOverrideMethodsCommand(languageClient, context);
    registerHashCodeEqualsCommand(languageClient, context);
    registerOrganizeImportsCommand(languageClient, context);
    registerChooseImportCommand(context);
    registerGenerateToStringCommand(languageClient, context);
    registerGenerateAccessorsCommand(languageClient, context);
    registerGenerateConstructorsCommand(languageClient, context);
    registerGenerateDelegateMethodsCommand(languageClient, context);
}

function registerOverrideMethodsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.OVERRIDE_METHODS_PROMPT, async (params: CodeActionParams) => {
        const result = await languageClient.sendRequest(ListOverridableMethodsRequest.type, params);
        if (!result || !result.methods || !result.methods.length) {
            window.showWarningMessage('No overridable methods found in the super type.');
            return;
        }

        result.methods.sort((a, b) => {
            const declaringClass = a.declaringClass.localeCompare(b.declaringClass);
            if (declaringClass !== 0) {
                return declaringClass;
            }

            const methodName = a.name.localeCompare(b.name);
            if (methodName !== 0) {
                return methodName;
            }

            return a.parameters.length - b.parameters.length;
        });

        const quickPickItems = result.methods.map(method => {
            return {
                label: `${method.name}(${method.parameters.join(',')})`,
                description: `${method.declaringClassType}: ${method.declaringClass}`,
                picked: method.unimplemented,
                originalMethod: method,
            };
        });

        const selectedItems = await window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: `Select methods to override or implement in ${result.type}`
        });
        if (!selectedItems.length) {
            return;
        }

        const workspaceEdit = await languageClient.sendRequest(AddOverridableMethodsRequest.type, {
            context: params,
            overridableMethods: selectedItems.map((item) => item.originalMethod),
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerHashCodeEqualsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.HASHCODE_EQUALS_PROMPT, async (params: CodeActionParams) => {
        const result = await languageClient.sendRequest(CheckHashCodeEqualsStatusRequest.type, params);
        if (!result || !result.fields || !result.fields.length) {
            window.showErrorMessage(`The operation is not applicable to the type ${result.type}.`);
            return;
        }

        let regenerate = false;
        if (result.existingMethods && result.existingMethods.length) {
            const ans = await window.showInformationMessage(`Methods ${result.existingMethods.join(' and ')} already ${result.existingMethods.length === 1 ? 'exists' : 'exist'} in the Class '${result.type}'. `
                + 'Do you want to regenerate the implementation?', 'Regenerate', 'Cancel');
            if (ans !== 'Regenerate') {
                return;
            }

            regenerate = true;
        }

        const fieldItems = result.fields.map((field) => {
            return {
                label: `${field.name}: ${field.type}`,
                picked: true,
                originalField: field
            };
        });
        const selectedFields = await window.showQuickPick(fieldItems, {
            canPickMany: true,
            placeHolder:  'Select the fields to include in the hashCode() and equals() methods.'
        });
        if (!selectedFields.length) {
            return;
        }

        const workspaceEdit = await languageClient.sendRequest(GenerateHashCodeEqualsRequest.type, {
            context: params,
            fields: selectedFields.map((item) => item.originalField),
            regenerate
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerOrganizeImportsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.ORGANIZE_IMPORTS, async (params: CodeActionParams) => {
        const workspaceEdit = await languageClient.sendRequest(OrganizeImportsRequest.type, params);
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerChooseImportCommand(context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.CHOOSE_IMPORTS, async (uri: string, selections: ImportSelection[]) => {
        const chosen: ImportCandidate[] = [];
        const fileUri: Uri = Uri.parse(uri);
        for (let i = 0; i < selections.length; i++) {
            const selection: ImportSelection = selections[i];
            // Move the cursor to the code line with ambiguous import choices.
            await window.showTextDocument(fileUri, { preserveFocus: true, selection: selection.range, viewColumn: ViewColumn.One });
            const candidates: ImportCandidate[] = selection.candidates;
            const items = candidates.map((item) => {
                return {
                    label: item.fullyQualifiedName,
                    origin: item
                };
            });

            const fullyQualifiedName = candidates[0].fullyQualifiedName;
            const typeName = fullyQualifiedName.substring(fullyQualifiedName.lastIndexOf(".") + 1);
            const disposables: Disposable[] = [];
            try {
                const pick = await new Promise<any>((resolve, reject) => {
                    const input = window.createQuickPick();
                    input.title = "Organize Imports";
                    input.step = i + 1;
                    input.totalSteps = selections.length;
                    input.placeholder = `Choose type '${typeName}' to import`;
                    input.items = items;
                    disposables.push(
                        input.onDidChangeSelection(items => resolve(items[0])),
                        input.onDidHide(() => {
                            reject(undefined);
                        }),
                        input
                    );
                    input.show();
                });
                chosen.push(pick ? pick.origin : null);
            } catch (err) {
                break;
            } finally {
                disposables.forEach(d => d.dispose());
            }
        }

        return chosen;
    }));
}

function registerGenerateToStringCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.GENERATE_TOSTRING_PROMPT, async (params: CodeActionParams) => {
        const result = await languageClient.sendRequest(CheckToStringStatusRequest.type, params);
        if (!result) {
            return;
        }

        if (result.exists) {
            const ans = await window.showInformationMessage(`Method 'toString()' already exists in the Class '${result.type}'. `
                + 'Do you want to replace the implementation?', 'Replace', 'Cancel');
            if (ans !== 'Replace') {
                return;
            }
        }

        let fields: VariableBinding[] = [];
        if (result.fields && result.fields.length) {
            const fieldItems = result.fields.map((field) => {
                return {
                    label: `${field.name}: ${field.type}`,
                    picked: true,
                    originalField: field
                };
            });
            const selectedFields = await window.showQuickPick(fieldItems, {
                canPickMany: true,
                placeHolder:  'Select the fields to include in the toString() method.'
            });
            if (!selectedFields) {
                return;
            }

            fields = selectedFields.map((item) => item.originalField);
        }

        const workspaceEdit = await languageClient.sendRequest(GenerateToStringRequest.type, {
            context: params,
            fields,
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerGenerateAccessorsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.GENERATE_ACCESSORS_PROMPT, async (params: CodeActionParams) => {
        const accessors = await languageClient.sendRequest(ResolveUnimplementedAccessorsRequest.type, params);
        if (!accessors || !accessors.length) {
            return;
        }

        const accessorItems = accessors.map((accessor) => {
            const description = [];
            if (accessor.generateGetter) {
                description.push('getter');
            }
            if (accessor.generateSetter) {
                description.push('setter');
            }
            return {
                label: accessor.fieldName,
                description: (accessor.isStatic?'static ':'')+ description.join(', '),
                originalField: accessor,
            };
        });
        const selectedAccessors = await window.showQuickPick(accessorItems, {
            canPickMany: true,
            placeHolder:  'Select the fields to generate getters and setters.'
        });
        if (!selectedAccessors.length) {
            return;
        }

        const workspaceEdit = await languageClient.sendRequest(GenerateAccessorsRequest.type, {
            context: params,
            accessors: selectedAccessors.map((item) => item.originalField),
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerGenerateConstructorsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.GENERATE_CONSTRUCTORS_PROMPT, async (params: CodeActionParams) => {
        const status = await languageClient.sendRequest(CheckConstructorStatusRequest.type, params);
        if (!status || !status.constructors || !status.constructors.length) {
            return;
        }

        let selectedConstructors = status.constructors;
        let selectedFields = [];
        if (status.constructors.length > 1) {
            const constructorItems = status.constructors.map((constructor) => {
                return {
                    label: `${constructor.name}(${constructor.parameters.join(',')})`,
                    originalConstructor: constructor,
                };
            });
            const selectedConstructorItems = await window.showQuickPick(constructorItems, {
                canPickMany: true,
                placeHolder: 'Select super class constructor(s).',
            });
            if (!selectedConstructorItems || !selectedConstructorItems.length) {
                return;
            }

            selectedConstructors = selectedConstructorItems.map(item => item.originalConstructor);
        }

        if (status.fields.length) {
            const fieldItems = status.fields.map((field) => {
                return {
                    label: `${field.name}: ${field.type}`,
                    originalField: field,
                };
            });
            const selectedFieldItems = await window.showQuickPick(fieldItems, {
                canPickMany: true,
                placeHolder: 'Select fields to initialize by constructor(s).',
            });
            if (!selectedFieldItems) {
                return;
            }

            selectedFields = selectedFieldItems.map(item => item.originalField);
        }

        const workspaceEdit = await languageClient.sendRequest(GenerateConstructorsRequest.type, {
            context: params,
            constructors: selectedConstructors,
            fields: selectedFields,
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}

function registerGenerateDelegateMethodsCommand(languageClient: LanguageClient, context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand(Commands.GENERATE_DELEGATE_METHODS_PROMPT, async (params: CodeActionParams) => {
        const status = await languageClient.sendRequest(CheckDelegateMethodsStatusRequest.type, params);
        if (!status || !status.delegateFields || !status.delegateFields.length) {
            window.showWarningMessage("All delegatable methods are already implemented.");
            return;
        }

        let selectedDelegateField = status.delegateFields[0];
        if (status.delegateFields.length > 1) {
            const fieldItems = status.delegateFields.map((delegateField) => {
                return {
                    label: `${delegateField.field.name}: ${delegateField.field.type}`,
                    originalField: delegateField,
                };
            });
            const selectedFieldItem = await window.showQuickPick(fieldItems, {
                placeHolder: 'Select target to generate delegates for.',
            });
            if (!selectedFieldItem) {
                return;
            }

            selectedDelegateField = selectedFieldItem.originalField;
        }

        let delegateEntryItems = selectedDelegateField.delegateMethods.map(delegateMethod => {
            return {
                label: `${selectedDelegateField.field.name}.${delegateMethod.name}(${delegateMethod.parameters.join(',')})`,
                originalField: selectedDelegateField.field,
                originalMethod: delegateMethod,
            }
        });

        if (!delegateEntryItems.length) {
            window.showWarningMessage("All delegatable methods are already implemented.");
            return;
        }

        const selectedDelegateEntryItems = await window.showQuickPick(delegateEntryItems, {
            canPickMany: true,
            placeHolder: 'Select methods to generate delegates for.',
        });
        if (!selectedDelegateEntryItems || !selectedDelegateEntryItems.length) {
            return;
        }

        const delegateEntries = selectedDelegateEntryItems.map(item => {
            return {
                field: item.originalField,
                delegateMethod: item.originalMethod,
            };
        });
        const workspaceEdit = await languageClient.sendRequest(GenerateDelegateMethodsRequest.type, {
            context: params,
            delegateEntries,
        });
        applyWorkspaceEdit(workspaceEdit, languageClient);
    }));
}