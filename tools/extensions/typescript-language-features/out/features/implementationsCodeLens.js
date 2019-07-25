"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nls = require("vscode-nls");
const PConst = require("../protocol.const");
const api_1 = require("../utils/api");
const dependentRegistration_1 = require("../utils/dependentRegistration");
const baseCodeLensProvider_1 = require("./baseCodeLensProvider");
const localize = nls.loadMessageBundle();
class TypeScriptImplementationsCodeLensProvider extends baseCodeLensProvider_1.TypeScriptBaseCodeLensProvider {
    async resolveCodeLens(inputCodeLens, _token) {
        const codeLens = inputCodeLens;
        try {
            const locations = await vscode.commands.executeCommand('vscode.executeImplementationProvider', codeLens.document, codeLens.range.start);
            if (locations) {
                codeLens.command = this.getCommand(locations, codeLens);
                return codeLens;
            }
        }
        catch (_a) {
            // noop
        }
        codeLens.command = {
            title: localize('implementationsErrorLabel', 'Could not determine implementations'),
            command: ''
        };
        return codeLens;
    }
    getCommand(locations, codeLens) {
        return {
            title: this.getTitle(locations),
            command: locations.length ? 'editor.action.showReferences' : '',
            arguments: [codeLens.document, codeLens.range.start, locations]
        };
    }
    getTitle(locations) {
        return locations.length === 1
            ? localize('oneImplementationLabel', '1 implementation')
            : localize('manyImplementationLabel', '{0} implementations', locations.length);
    }
    extractSymbol(document, item, _parent) {
        switch (item.kind) {
            case PConst.Kind.interface:
                return baseCodeLensProvider_1.getSymbolRange(document, item);
            case PConst.Kind.class:
            case PConst.Kind.memberFunction:
            case PConst.Kind.memberVariable:
            case PConst.Kind.memberGetAccessor:
            case PConst.Kind.memberSetAccessor:
                if (item.kindModifiers.match(/\babstract\b/g)) {
                    return baseCodeLensProvider_1.getSymbolRange(document, item);
                }
                break;
        }
        return null;
    }
}
exports.default = TypeScriptImplementationsCodeLensProvider;
function register(selector, modeId, client, cachedResponse) {
    return new dependentRegistration_1.VersionDependentRegistration(client, api_1.default.v220, () => new dependentRegistration_1.ConfigurationDependentRegistration(modeId, 'implementationsCodeLens.enabled', () => {
        return vscode.languages.registerCodeLensProvider(selector, new TypeScriptImplementationsCodeLensProvider(client, cachedResponse));
    }));
}
exports.register = register;
