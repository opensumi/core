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
const extension_1 = require("./extension");
const protocol_1 = require("./protocol");
function registerCommands(languageClient, context) {
    registerOverrideMethodsCommand(languageClient, context);
    registerHashCodeEqualsCommand(languageClient, context);
    registerOrganizeImportsCommand(languageClient, context);
    registerChooseImportCommand(context);
    registerGenerateToStringCommand(languageClient, context);
    registerGenerateAccessorsCommand(languageClient, context);
    registerGenerateConstructorsCommand(languageClient, context);
    registerGenerateDelegateMethodsCommand(languageClient, context);
}
exports.registerCommands = registerCommands;
function registerOverrideMethodsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.OVERRIDE_METHODS_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const result = yield languageClient.sendRequest(protocol_1.ListOverridableMethodsRequest.type, params);
        if (!result || !result.methods || !result.methods.length) {
            vscode_1.window.showWarningMessage('No overridable methods found in the super type.');
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
        const selectedItems = yield vscode_1.window.showQuickPick(quickPickItems, {
            canPickMany: true,
            placeHolder: `Select methods to override or implement in ${result.type}`
        });
        if (!selectedItems.length) {
            return;
        }
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.AddOverridableMethodsRequest.type, {
            context: params,
            overridableMethods: selectedItems.map((item) => item.originalMethod),
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerHashCodeEqualsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.HASHCODE_EQUALS_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const result = yield languageClient.sendRequest(protocol_1.CheckHashCodeEqualsStatusRequest.type, params);
        if (!result || !result.fields || !result.fields.length) {
            vscode_1.window.showErrorMessage(`The operation is not applicable to the type ${result.type}.`);
            return;
        }
        let regenerate = false;
        if (result.existingMethods && result.existingMethods.length) {
            const ans = yield vscode_1.window.showInformationMessage(`Methods ${result.existingMethods.join(' and ')} already ${result.existingMethods.length === 1 ? 'exists' : 'exist'} in the Class '${result.type}'. `
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
        const selectedFields = yield vscode_1.window.showQuickPick(fieldItems, {
            canPickMany: true,
            placeHolder: 'Select the fields to include in the hashCode() and equals() methods.'
        });
        if (!selectedFields.length) {
            return;
        }
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.GenerateHashCodeEqualsRequest.type, {
            context: params,
            fields: selectedFields.map((item) => item.originalField),
            regenerate
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerOrganizeImportsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.ORGANIZE_IMPORTS, (params) => __awaiter(this, void 0, void 0, function* () {
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.OrganizeImportsRequest.type, params);
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerChooseImportCommand(context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.CHOOSE_IMPORTS, (uri, selections) => __awaiter(this, void 0, void 0, function* () {
        const chosen = [];
        const fileUri = vscode_1.Uri.parse(uri);
        for (let i = 0; i < selections.length; i++) {
            const selection = selections[i];
            // Move the cursor to the code line with ambiguous import choices.
            yield vscode_1.window.showTextDocument(fileUri, { preserveFocus: true, selection: selection.range, viewColumn: vscode_1.ViewColumn.One });
            const candidates = selection.candidates;
            const items = candidates.map((item) => {
                return {
                    label: item.fullyQualifiedName,
                    origin: item
                };
            });
            const fullyQualifiedName = candidates[0].fullyQualifiedName;
            const typeName = fullyQualifiedName.substring(fullyQualifiedName.lastIndexOf(".") + 1);
            const disposables = [];
            try {
                const pick = yield new Promise((resolve, reject) => {
                    const input = vscode_1.window.createQuickPick();
                    input.title = "Organize Imports";
                    input.step = i + 1;
                    input.totalSteps = selections.length;
                    input.placeholder = `Choose type '${typeName}' to import`;
                    input.items = items;
                    disposables.push(input.onDidChangeSelection(items => resolve(items[0])), input.onDidHide(() => {
                        reject(undefined);
                    }), input);
                    input.show();
                });
                chosen.push(pick ? pick.origin : null);
            }
            catch (err) {
                break;
            }
            finally {
                disposables.forEach(d => d.dispose());
            }
        }
        return chosen;
    })));
}
function registerGenerateToStringCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.GENERATE_TOSTRING_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const result = yield languageClient.sendRequest(protocol_1.CheckToStringStatusRequest.type, params);
        if (!result) {
            return;
        }
        if (result.exists) {
            const ans = yield vscode_1.window.showInformationMessage(`Method 'toString()' already exists in the Class '${result.type}'. `
                + 'Do you want to replace the implementation?', 'Replace', 'Cancel');
            if (ans !== 'Replace') {
                return;
            }
        }
        let fields = [];
        if (result.fields && result.fields.length) {
            const fieldItems = result.fields.map((field) => {
                return {
                    label: `${field.name}: ${field.type}`,
                    picked: true,
                    originalField: field
                };
            });
            const selectedFields = yield vscode_1.window.showQuickPick(fieldItems, {
                canPickMany: true,
                placeHolder: 'Select the fields to include in the toString() method.'
            });
            if (!selectedFields) {
                return;
            }
            fields = selectedFields.map((item) => item.originalField);
        }
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.GenerateToStringRequest.type, {
            context: params,
            fields,
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerGenerateAccessorsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.GENERATE_ACCESSORS_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const accessors = yield languageClient.sendRequest(protocol_1.ResolveUnimplementedAccessorsRequest.type, params);
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
                description: (accessor.isStatic ? 'static ' : '') + description.join(', '),
                originalField: accessor,
            };
        });
        const selectedAccessors = yield vscode_1.window.showQuickPick(accessorItems, {
            canPickMany: true,
            placeHolder: 'Select the fields to generate getters and setters.'
        });
        if (!selectedAccessors.length) {
            return;
        }
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.GenerateAccessorsRequest.type, {
            context: params,
            accessors: selectedAccessors.map((item) => item.originalField),
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerGenerateConstructorsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.GENERATE_CONSTRUCTORS_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const status = yield languageClient.sendRequest(protocol_1.CheckConstructorStatusRequest.type, params);
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
            const selectedConstructorItems = yield vscode_1.window.showQuickPick(constructorItems, {
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
            const selectedFieldItems = yield vscode_1.window.showQuickPick(fieldItems, {
                canPickMany: true,
                placeHolder: 'Select fields to initialize by constructor(s).',
            });
            if (!selectedFieldItems) {
                return;
            }
            selectedFields = selectedFieldItems.map(item => item.originalField);
        }
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.GenerateConstructorsRequest.type, {
            context: params,
            constructors: selectedConstructors,
            fields: selectedFields,
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
function registerGenerateDelegateMethodsCommand(languageClient, context) {
    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.GENERATE_DELEGATE_METHODS_PROMPT, (params) => __awaiter(this, void 0, void 0, function* () {
        const status = yield languageClient.sendRequest(protocol_1.CheckDelegateMethodsStatusRequest.type, params);
        if (!status || !status.delegateFields || !status.delegateFields.length) {
            vscode_1.window.showWarningMessage("All delegatable methods are already implemented.");
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
            const selectedFieldItem = yield vscode_1.window.showQuickPick(fieldItems, {
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
            };
        });
        if (!delegateEntryItems.length) {
            vscode_1.window.showWarningMessage("All delegatable methods are already implemented.");
            return;
        }
        const selectedDelegateEntryItems = yield vscode_1.window.showQuickPick(delegateEntryItems, {
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
        const workspaceEdit = yield languageClient.sendRequest(protocol_1.GenerateDelegateMethodsRequest.type, {
            context: params,
            delegateEntries,
        });
        extension_1.applyWorkspaceEdit(workspaceEdit, languageClient);
    })));
}
//# sourceMappingURL=sourceAction.js.map