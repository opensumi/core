"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const languageModeIds = require("./languageModeIds");
class VersionStatus {
    constructor(_normalizePath) {
        this._normalizePath = _normalizePath;
        this._versionBarEntry = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 99 /* to the right of editor status (100) */);
        this._onChangeEditorSub = vscode.window.onDidChangeActiveTextEditor(this.showHideStatus, this);
    }
    dispose() {
        this._versionBarEntry.dispose();
        this._onChangeEditorSub.dispose();
    }
    onDidChangeTypeScriptVersion(version) {
        this.showHideStatus();
        this._versionBarEntry.text = version.versionString;
        this._versionBarEntry.tooltip = version.path;
        this._versionBarEntry.command = 'typescript.selectTypeScriptVersion';
    }
    showHideStatus() {
        if (!vscode.window.activeTextEditor) {
            this._versionBarEntry.hide();
            return;
        }
        const doc = vscode.window.activeTextEditor.document;
        if (vscode.languages.match([languageModeIds.typescript, languageModeIds.typescriptreact], doc)) {
            if (this._normalizePath(doc.uri)) {
                this._versionBarEntry.show();
            }
            else {
                this._versionBarEntry.hide();
            }
            return;
        }
        if (!vscode.window.activeTextEditor.viewColumn) {
            // viewColumn is undefined for the debug/output panel, but we still want
            // to show the version info in the existing editor
            return;
        }
        this._versionBarEntry.hide();
    }
}
exports.default = VersionStatus;
