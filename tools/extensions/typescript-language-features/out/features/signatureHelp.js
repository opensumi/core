"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const Previewer = require("../utils/previewer");
const typeConverters = require("../utils/typeConverters");
class TypeScriptSignatureHelpProvider {
    constructor(client) {
        this.client = client;
    }
    async provideSignatureHelp(document, position, token, context) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return undefined;
        }
        const args = Object.assign({}, typeConverters.Position.toFileLocationRequestArgs(filepath, position), { triggerReason: toTsTriggerReason(context) });
        const response = await this.client.execute('signatureHelp', args, token);
        if (response.type !== 'response' || !response.body) {
            return undefined;
        }
        const info = response.body;
        const result = new vscode.SignatureHelp();
        result.activeSignature = info.selectedItemIndex;
        result.activeParameter = this.getActiveParmeter(info);
        result.signatures = info.items.map(signature => this.convertSignature(signature));
        return result;
    }
    getActiveParmeter(info) {
        const activeSignature = info.items[info.selectedItemIndex];
        if (activeSignature && activeSignature.isVariadic) {
            return Math.min(info.argumentIndex, activeSignature.parameters.length - 1);
        }
        return info.argumentIndex;
    }
    convertSignature(item) {
        const signature = new vscode.SignatureInformation(Previewer.plain(item.prefixDisplayParts), Previewer.markdownDocumentation(item.documentation, item.tags.filter(x => x.name !== 'param')));
        signature.parameters = item.parameters.map(p => new vscode.ParameterInformation(Previewer.plain(p.displayParts), Previewer.markdownDocumentation(p.documentation, [])));
        signature.label += signature.parameters.map(parameter => parameter.label).join(Previewer.plain(item.separatorDisplayParts));
        signature.label += Previewer.plain(item.suffixDisplayParts);
        return signature;
    }
}
TypeScriptSignatureHelpProvider.triggerCharacters = ['(', ',', '<'];
TypeScriptSignatureHelpProvider.retriggerCharacters = [')'];
function toTsTriggerReason(context) {
    switch (context.triggerKind) {
        case vscode.SignatureHelpTriggerKind.TriggerCharacter:
            if (context.triggerCharacter) {
                if (context.isRetrigger) {
                    return { kind: 'retrigger', triggerCharacter: context.triggerCharacter };
                }
                else {
                    return { kind: 'characterTyped', triggerCharacter: context.triggerCharacter };
                }
            }
            else {
                return { kind: 'invoked' };
            }
        case vscode.SignatureHelpTriggerKind.ContentChange:
            return context.isRetrigger ? { kind: 'retrigger' } : { kind: 'invoked' };
        case vscode.SignatureHelpTriggerKind.Invoke:
        default:
            return { kind: 'invoked' };
    }
}
function register(selector, client) {
    return vscode.languages.registerSignatureHelpProvider(selector, new TypeScriptSignatureHelpProvider(client), {
        triggerCharacters: TypeScriptSignatureHelpProvider.triggerCharacters,
        retriggerCharacters: TypeScriptSignatureHelpProvider.retriggerCharacters
    });
}
exports.register = register;
