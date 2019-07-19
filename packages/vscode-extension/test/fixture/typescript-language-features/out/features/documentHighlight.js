"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const typeConverters = require("../utils/typeConverters");
class TypeScriptDocumentHighlightProvider {
    constructor(client) {
        this.client = client;
    }
    async provideDocumentHighlights(resource, position, token) {
        const file = this.client.toPath(resource.uri);
        if (!file) {
            return [];
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(file, position);
        const response = await this.client.execute('references', args, token);
        if (response.type !== 'response' || !response.body) {
            return [];
        }
        return response.body.refs
            .filter(ref => ref.file === file)
            .map(documentHighlightFromReference);
    }
}
function documentHighlightFromReference(reference) {
    return new vscode.DocumentHighlight(typeConverters.Range.fromTextSpan(reference), reference.isWriteAccess ? vscode.DocumentHighlightKind.Write : vscode.DocumentHighlightKind.Read);
}
function register(selector, client) {
    return vscode.languages.registerDocumentHighlightProvider(selector, new TypeScriptDocumentHighlightProvider(client));
}
exports.register = register;
