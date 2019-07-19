"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const regexp_1 = require("../utils/regexp");
const typeConverters = require("../utils/typeConverters");
class ReferencesCodeLens extends vscode.CodeLens {
    constructor(document, file, range) {
        super(range);
        this.document = document;
        this.file = file;
    }
}
exports.ReferencesCodeLens = ReferencesCodeLens;
class CachedResponse {
    constructor() {
        this.version = -1;
        this.document = '';
    }
    execute(document, f) {
        if (this.matches(document)) {
            return this.response;
        }
        return this.update(document, f());
    }
    matches(document) {
        return this.version === document.version && this.document === document.uri.toString();
    }
    update(document, response) {
        this.response = response;
        this.version = document.version;
        this.document = document.uri.toString();
        return response;
    }
}
exports.CachedResponse = CachedResponse;
class TypeScriptBaseCodeLensProvider {
    constructor(client, cachedResponse) {
        this.client = client;
        this.cachedResponse = cachedResponse;
        this.onDidChangeCodeLensesEmitter = new vscode.EventEmitter();
    }
    get onDidChangeCodeLenses() {
        return this.onDidChangeCodeLensesEmitter.event;
    }
    async provideCodeLenses(document, token) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return [];
        }
        const response = await this.cachedResponse.execute(document, () => this.client.execute('navtree', { file: filepath }, token));
        if (!response || response.type !== 'response') {
            return [];
        }
        const tree = response.body;
        const referenceableSpans = [];
        if (tree && tree.childItems) {
            tree.childItems.forEach(item => this.walkNavTree(document, item, null, referenceableSpans));
        }
        return referenceableSpans.map(span => new ReferencesCodeLens(document.uri, filepath, span));
    }
    walkNavTree(document, item, parent, results) {
        if (!item) {
            return;
        }
        const range = this.extractSymbol(document, item, parent);
        if (range) {
            results.push(range);
        }
        (item.childItems || []).forEach(child => this.walkNavTree(document, child, item, results));
    }
}
exports.TypeScriptBaseCodeLensProvider = TypeScriptBaseCodeLensProvider;
function getSymbolRange(document, item) {
    // TS 3.0+ provides a span for just the symbol
    if (item.nameSpan) {
        return typeConverters.Range.fromTextSpan(item.nameSpan);
    }
    // In older versions, we have to calculate this manually. See #23924
    const span = item.spans && item.spans[0];
    if (!span) {
        return null;
    }
    const range = typeConverters.Range.fromTextSpan(span);
    const text = document.getText(range);
    const identifierMatch = new RegExp(`^(.*?(\\b|\\W))${regexp_1.escapeRegExp(item.text || '')}(\\b|\\W)`, 'gm');
    const match = identifierMatch.exec(text);
    const prefixLength = match ? match.index + match[1].length : 0;
    const startOffset = document.offsetAt(new vscode.Position(range.start.line, range.start.character)) + prefixLength;
    return new vscode.Range(document.positionAt(startOffset), document.positionAt(startOffset + item.text.length));
}
exports.getSymbolRange = getSymbolRange;
