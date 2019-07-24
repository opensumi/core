/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
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
const vscode = require("vscode");
class MergeConflictContentProvider {
    constructor(context) {
        this.context = context;
    }
    begin() {
        this.context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(MergeConflictContentProvider.scheme, this));
    }
    dispose() {
    }
    provideTextDocumentContent(uri) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { scheme, range } = JSON.parse(uri.query);
                const [start, end] = range;
                const document = yield vscode.workspace.openTextDocument(uri.with({ scheme, query: '' }));
                const text = document.getText(new vscode.Range(start.line, start.character, end.line, end.character));
                return text;
            }
            catch (ex) {
                yield vscode.window.showErrorMessage('Unable to show comparison');
                return null;
            }
        });
    }
}
MergeConflictContentProvider.scheme = 'merge-conflict.conflict-diff';
exports.default = MergeConflictContentProvider;
//# sourceMappingURL=contentProvider.js.map