"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
const vscode = require("vscode");
const contentProvider_1 = require("./contentProvider");
const path = require("path");
const vscode_nls_1 = require("vscode-nls");
const localize = vscode_nls_1.loadMessageBundle();
var NavigationDirection;
(function (NavigationDirection) {
    NavigationDirection[NavigationDirection["Forwards"] = 0] = "Forwards";
    NavigationDirection[NavigationDirection["Backwards"] = 1] = "Backwards";
})(NavigationDirection || (NavigationDirection = {}));
class CommandHandler {
    constructor(trackerService) {
        this.disposables = [];
        this.tracker = trackerService.createTracker('commands');
    }
    begin() {
        this.disposables.push(this.registerTextEditorCommand('merge-conflict.accept.current', this.acceptCurrent), this.registerTextEditorCommand('merge-conflict.accept.incoming', this.acceptIncoming), this.registerTextEditorCommand('merge-conflict.accept.selection', this.acceptSelection), this.registerTextEditorCommand('merge-conflict.accept.both', this.acceptBoth), this.registerTextEditorCommand('merge-conflict.accept.all-current', this.acceptAllCurrent), this.registerTextEditorCommand('merge-conflict.accept.all-incoming', this.acceptAllIncoming), this.registerTextEditorCommand('merge-conflict.accept.all-both', this.acceptAllBoth), this.registerTextEditorCommand('merge-conflict.next', this.navigateNext), this.registerTextEditorCommand('merge-conflict.previous', this.navigatePrevious), this.registerTextEditorCommand('merge-conflict.compare', this.compare));
    }
    registerTextEditorCommand(command, cb) {
        return vscode.commands.registerCommand(command, (...args) => {
            const editor = vscode.window.activeTextEditor;
            return editor && cb.call(this, editor, ...args);
        });
    }
    acceptCurrent(editor, ...args) {
        return this.accept(0 /* Current */, editor, ...args);
    }
    acceptIncoming(editor, ...args) {
        return this.accept(1 /* Incoming */, editor, ...args);
    }
    acceptBoth(editor, ...args) {
        return this.accept(2 /* Both */, editor, ...args);
    }
    acceptAllCurrent(editor) {
        return this.acceptAll(0 /* Current */, editor);
    }
    acceptAllIncoming(editor) {
        return this.acceptAll(1 /* Incoming */, editor);
    }
    acceptAllBoth(editor) {
        return this.acceptAll(2 /* Both */, editor);
    }
    compare(editor, conflict) {
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = path.basename(editor.document.uri.fsPath);
            // No conflict, command executed from command palette
            if (!conflict) {
                conflict = yield this.findConflictContainingSelection(editor);
                // Still failed to find conflict, warn the user and exit
                if (!conflict) {
                    vscode.window.showWarningMessage(localize('cursorNotInConflict', 'Editor cursor is not within a merge conflict'));
                    return;
                }
            }
            const scheme = editor.document.uri.scheme;
            let range = conflict.current.content;
            const leftUri = editor.document.uri.with({
                scheme: contentProvider_1.default.scheme,
                query: JSON.stringify({ scheme, range })
            });
            range = conflict.incoming.content;
            const rightUri = leftUri.with({ query: JSON.stringify({ scheme, range }) });
            const title = localize('compareChangesTitle', '{0}: Current Changes ⟷ Incoming Changes', fileName);
            vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
        });
    }
    navigateNext(editor) {
        return this.navigate(editor, NavigationDirection.Forwards);
    }
    navigatePrevious(editor) {
        return this.navigate(editor, NavigationDirection.Backwards);
    }
    acceptSelection(editor) {
        return __awaiter(this, void 0, void 0, function* () {
            let conflict = yield this.findConflictContainingSelection(editor);
            if (!conflict) {
                vscode.window.showWarningMessage(localize('cursorNotInConflict', 'Editor cursor is not within a merge conflict'));
                return;
            }
            let typeToAccept;
            let tokenAfterCurrentBlock = conflict.splitter;
            if (conflict.commonAncestors.length > 0) {
                tokenAfterCurrentBlock = conflict.commonAncestors[0].header;
            }
            // Figure out if the cursor is in current or incoming, we do this by seeing if
            // the active position is before or after the range of the splitter or common
            // ancestors marker. We can use this trick as the previous check in
            // findConflictByActiveSelection will ensure it's within the conflict range, so
            // we don't falsely identify "current" or "incoming" if outside of a conflict range.
            if (editor.selection.active.isBefore(tokenAfterCurrentBlock.start)) {
                typeToAccept = 0 /* Current */;
            }
            else if (editor.selection.active.isAfter(conflict.splitter.end)) {
                typeToAccept = 1 /* Incoming */;
            }
            else if (editor.selection.active.isBefore(conflict.splitter.start)) {
                vscode.window.showWarningMessage(localize('cursorOnCommonAncestorsRange', 'Editor cursor is within the common ancestors block, please move it to either the "current" or "incoming" block'));
                return;
            }
            else {
                vscode.window.showWarningMessage(localize('cursorOnSplitterRange', 'Editor cursor is within the merge conflict splitter, please move it to either the "current" or "incoming" block'));
                return;
            }
            this.tracker.forget(editor.document);
            conflict.commitEdit(typeToAccept, editor);
        });
    }
    dispose() {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    navigate(editor, direction) {
        return __awaiter(this, void 0, void 0, function* () {
            let navigationResult = yield this.findConflictForNavigation(editor, direction);
            if (!navigationResult) {
                vscode.window.showWarningMessage(localize('noConflicts', 'No merge conflicts found in this file'));
                return;
            }
            else if (!navigationResult.canNavigate) {
                vscode.window.showWarningMessage(localize('noOtherConflictsInThisFile', 'No other merge conflicts within this file'));
                return;
            }
            else if (!navigationResult.conflict) {
                // TODO: Show error message?
                return;
            }
            // Move the selection to the first line of the conflict
            editor.selection = new vscode.Selection(navigationResult.conflict.range.start, navigationResult.conflict.range.start);
            editor.revealRange(navigationResult.conflict.range, vscode.TextEditorRevealType.Default);
        });
    }
    accept(type, editor, ...args) {
        return __awaiter(this, void 0, void 0, function* () {
            let conflict;
            // If launched with known context, take the conflict from that
            if (args[0] === 'known-conflict') {
                conflict = args[1];
            }
            else {
                // Attempt to find a conflict that matches the current cursor position
                conflict = yield this.findConflictContainingSelection(editor);
            }
            if (!conflict) {
                vscode.window.showWarningMessage(localize('cursorNotInConflict', 'Editor cursor is not within a merge conflict'));
                return;
            }
            // Tracker can forget as we know we are going to do an edit
            this.tracker.forget(editor.document);
            conflict.commitEdit(type, editor);
        });
    }
    acceptAll(type, editor) {
        return __awaiter(this, void 0, void 0, function* () {
            let conflicts = yield this.tracker.getConflicts(editor.document);
            if (!conflicts || conflicts.length === 0) {
                vscode.window.showWarningMessage(localize('noConflicts', 'No merge conflicts found in this file'));
                return;
            }
            // For get the current state of the document, as we know we are doing to do a large edit
            this.tracker.forget(editor.document);
            // Apply all changes as one edit
            yield editor.edit((edit) => conflicts.forEach(conflict => {
                conflict.applyEdit(type, editor, edit);
            }));
        });
    }
    findConflictContainingSelection(editor, conflicts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!conflicts) {
                conflicts = yield this.tracker.getConflicts(editor.document);
            }
            if (!conflicts || conflicts.length === 0) {
                return null;
            }
            for (let i = 0; i < conflicts.length; i++) {
                if (conflicts[i].range.contains(editor.selection.active)) {
                    return conflicts[i];
                }
            }
            return null;
        });
    }
    findConflictForNavigation(editor, direction, conflicts) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!conflicts) {
                conflicts = yield this.tracker.getConflicts(editor.document);
            }
            if (!conflicts || conflicts.length === 0) {
                return null;
            }
            let selection = editor.selection.active;
            if (conflicts.length === 1) {
                if (conflicts[0].range.contains(selection)) {
                    return {
                        canNavigate: false
                    };
                }
                return {
                    canNavigate: true,
                    conflict: conflicts[0]
                };
            }
            let predicate;
            let fallback;
            if (direction === NavigationDirection.Forwards) {
                predicate = (conflict) => selection.isBefore(conflict.range.start);
                fallback = () => conflicts[0];
            }
            else if (direction === NavigationDirection.Backwards) {
                predicate = (conflict) => selection.isAfter(conflict.range.start);
                fallback = () => conflicts[conflicts.length - 1];
            }
            else {
                throw new Error(`Unsupported direction ${direction}`);
            }
            for (let i = 0; i < conflicts.length; i++) {
                if (predicate(conflicts[i]) && !conflicts[i].range.contains(selection)) {
                    return {
                        canNavigate: true,
                        conflict: conflicts[i]
                    };
                }
            }
            // Went all the way to the end, return the head
            return {
                canNavigate: true,
                conflict: fallback()
            };
        });
    }
}
exports.default = CommandHandler;
//# sourceMappingURL=commandHandler.js.map