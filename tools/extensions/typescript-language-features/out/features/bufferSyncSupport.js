"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const vscode = require("vscode");
const api_1 = require("../utils/api");
const async_1 = require("../utils/async");
const dispose_1 = require("../utils/dispose");
const languageModeIds = require("../utils/languageModeIds");
const resourceMap_1 = require("../utils/resourceMap");
const typeConverters = require("../utils/typeConverters");
var BufferKind;
(function (BufferKind) {
    BufferKind[BufferKind["TypeScript"] = 1] = "TypeScript";
    BufferKind[BufferKind["JavaScript"] = 2] = "JavaScript";
})(BufferKind || (BufferKind = {}));
function mode2ScriptKind(mode) {
    switch (mode) {
        case languageModeIds.typescript: return 'TS';
        case languageModeIds.typescriptreact: return 'TSX';
        case languageModeIds.javascript: return 'JS';
        case languageModeIds.javascriptreact: return 'JSX';
    }
    return undefined;
}
class SyncedBuffer {
    constructor(document, filepath, client) {
        this.document = document;
        this.filepath = filepath;
        this.client = client;
    }
    open() {
        const args = {
            file: this.filepath,
            fileContent: this.document.getText(),
        };
        if (this.client.apiVersion.gte(api_1.default.v203)) {
            const scriptKind = mode2ScriptKind(this.document.languageId);
            if (scriptKind) {
                args.scriptKindName = scriptKind;
            }
        }
        if (this.client.apiVersion.gte(api_1.default.v230)) {
            args.projectRootPath = this.client.getWorkspaceRootForResource(this.document.uri);
        }
        if (this.client.apiVersion.gte(api_1.default.v240)) {
            const tsPluginsForDocument = this.client.pluginManager.plugins
                .filter(x => x.languages.indexOf(this.document.languageId) >= 0);
            if (tsPluginsForDocument.length) {
                args.plugins = tsPluginsForDocument.map(plugin => plugin.name);
            }
        }
        this.client.executeWithoutWaitingForResponse('open', args);
    }
    get resource() {
        return this.document.uri;
    }
    get lineCount() {
        return this.document.lineCount;
    }
    get kind() {
        switch (this.document.languageId) {
            case languageModeIds.javascript:
            case languageModeIds.javascriptreact:
                return BufferKind.JavaScript;
            case languageModeIds.typescript:
            case languageModeIds.typescriptreact:
            default:
                return BufferKind.TypeScript;
        }
    }
    close() {
        const args = {
            file: this.filepath
        };
        this.client.executeWithoutWaitingForResponse('close', args);
    }
    onContentChanged(events) {
        for (const { range, text } of events) {
            const args = Object.assign({ insertString: text }, typeConverters.Range.toFormattingRequestArgs(this.filepath, range));
            this.client.executeWithoutWaitingForResponse('change', args);
        }
    }
}
class SyncedBufferMap extends resourceMap_1.ResourceMap {
    getForPath(filePath) {
        return this.get(vscode.Uri.file(filePath));
    }
    get allBuffers() {
        return this.values;
    }
}
class PendingDiagnostics extends resourceMap_1.ResourceMap {
    getOrderedFileSet() {
        const orderedResources = Array.from(this.entries)
            .sort((a, b) => a.value - b.value)
            .map(entry => entry.resource);
        const map = new resourceMap_1.ResourceMap();
        for (const resource of orderedResources) {
            map.set(resource, void 0);
        }
        return map;
    }
}
class GetErrRequest {
    constructor(client, files, _token, onDone) {
        this.files = files;
        this._token = _token;
        this._done = false;
        const args = {
            delay: 0,
            files: Array.from(files.entries)
                .map(entry => client.normalizedPath(entry.resource))
                .filter(x => !!x)
        };
        client.executeAsync('geterr', args, _token.token)
            .catch(() => true)
            .then(() => {
            if (this._done) {
                return;
            }
            this._done = true;
            onDone();
        });
    }
    static executeGetErrRequest(client, files, onDone) {
        const token = new vscode.CancellationTokenSource();
        return new GetErrRequest(client, files, token, onDone);
    }
    cancel() {
        if (!this._done) {
            this._token.cancel();
        }
        this._token.dispose();
    }
}
class BufferSyncSupport extends dispose_1.Disposable {
    constructor(client, modeIds) {
        super();
        this._validateJavaScript = true;
        this._validateTypeScript = true;
        this.listening = false;
        this._onDelete = this._register(new vscode.EventEmitter());
        this.onDelete = this._onDelete.event;
        this.client = client;
        this.modeIds = new Set(modeIds);
        this.diagnosticDelayer = new async_1.Delayer(300);
        const pathNormalizer = (path) => this.client.normalizedPath(path);
        this.syncedBuffers = new SyncedBufferMap(pathNormalizer);
        this.pendingDiagnostics = new PendingDiagnostics(pathNormalizer);
        this.updateConfiguration();
        vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this, this._disposables);
    }
    listen() {
        if (this.listening) {
            return;
        }
        this.listening = true;
        vscode.workspace.onDidOpenTextDocument(this.openTextDocument, this, this._disposables);
        vscode.workspace.onDidCloseTextDocument(this.onDidCloseTextDocument, this, this._disposables);
        vscode.workspace.onDidChangeTextDocument(this.onDidChangeTextDocument, this, this._disposables);
        vscode.workspace.textDocuments.forEach(this.openTextDocument, this);
    }
    handles(resource) {
        return this.syncedBuffers.has(resource);
    }
    toResource(filePath) {
        const buffer = this.syncedBuffers.getForPath(filePath);
        if (buffer) {
            return buffer.resource;
        }
        return vscode.Uri.file(filePath);
    }
    reOpenDocuments() {
        for (const buffer of this.syncedBuffers.allBuffers) {
            buffer.open();
        }
    }
    openTextDocument(document) {
        if (!this.modeIds.has(document.languageId)) {
            return;
        }
        const resource = document.uri;
        const filepath = this.client.normalizedPath(resource);
        if (!filepath) {
            return;
        }
        if (this.syncedBuffers.has(resource)) {
            return;
        }
        const syncedBuffer = new SyncedBuffer(document, filepath, this.client);
        this.syncedBuffers.set(resource, syncedBuffer);
        syncedBuffer.open();
        this.requestDiagnostic(syncedBuffer);
    }
    closeResource(resource) {
        const syncedBuffer = this.syncedBuffers.get(resource);
        if (!syncedBuffer) {
            return;
        }
        this.pendingDiagnostics.delete(resource);
        this.syncedBuffers.delete(resource);
        syncedBuffer.close();
        if (!fs.existsSync(resource.fsPath)) {
            this._onDelete.fire(resource);
            this.requestAllDiagnostics();
        }
    }
    interuptGetErr(f) {
        if (!this.pendingGetErr) {
            return f();
        }
        this.pendingGetErr.cancel();
        this.pendingGetErr = undefined;
        const result = f();
        this.triggerDiagnostics();
        return result;
    }
    onDidCloseTextDocument(document) {
        this.closeResource(document.uri);
    }
    onDidChangeTextDocument(e) {
        const syncedBuffer = this.syncedBuffers.get(e.document.uri);
        if (!syncedBuffer) {
            return;
        }
        syncedBuffer.onContentChanged(e.contentChanges);
        const didTrigger = this.requestDiagnostic(syncedBuffer);
        if (!didTrigger && this.pendingGetErr) {
            // In this case we always want to re-trigger all diagnostics
            this.pendingGetErr.cancel();
            this.pendingGetErr = undefined;
            this.triggerDiagnostics();
        }
    }
    requestAllDiagnostics() {
        for (const buffer of this.syncedBuffers.allBuffers) {
            if (this.shouldValidate(buffer)) {
                this.pendingDiagnostics.set(buffer.resource, Date.now());
            }
        }
        this.triggerDiagnostics();
    }
    getErr(resources) {
        const handledResources = resources.filter(resource => this.handles(resource));
        if (!handledResources.length) {
            return;
        }
        for (const resource of handledResources) {
            this.pendingDiagnostics.set(resource, Date.now());
        }
        this.triggerDiagnostics();
    }
    triggerDiagnostics(delay = 200) {
        this.diagnosticDelayer.trigger(() => {
            this.sendPendingDiagnostics();
        }, delay);
    }
    requestDiagnostic(buffer) {
        if (!this.shouldValidate(buffer)) {
            return false;
        }
        this.pendingDiagnostics.set(buffer.resource, Date.now());
        const delay = Math.min(Math.max(Math.ceil(buffer.lineCount / 20), 300), 800);
        this.triggerDiagnostics(delay);
        return true;
    }
    hasPendingDiagnostics(resource) {
        return this.pendingDiagnostics.has(resource);
    }
    sendPendingDiagnostics() {
        const orderedFileSet = this.pendingDiagnostics.getOrderedFileSet();
        // Add all open TS buffers to the geterr request. They might be visible
        for (const buffer of this.syncedBuffers.values) {
            orderedFileSet.set(buffer.resource, void 0);
        }
        if (orderedFileSet.size) {
            if (this.pendingGetErr) {
                this.pendingGetErr.cancel();
                for (const file of this.pendingGetErr.files.entries) {
                    orderedFileSet.set(file.resource, void 0);
                }
            }
            const getErr = this.pendingGetErr = GetErrRequest.executeGetErrRequest(this.client, orderedFileSet, () => {
                if (this.pendingGetErr === getErr) {
                    this.pendingGetErr = undefined;
                }
            });
        }
        this.pendingDiagnostics.clear();
    }
    updateConfiguration() {
        const jsConfig = vscode.workspace.getConfiguration('javascript', null);
        const tsConfig = vscode.workspace.getConfiguration('typescript', null);
        this._validateJavaScript = jsConfig.get('validate.enable', true);
        this._validateTypeScript = tsConfig.get('validate.enable', true);
    }
    shouldValidate(buffer) {
        switch (buffer.kind) {
            case BufferKind.JavaScript:
                return this._validateJavaScript;
            case BufferKind.TypeScript:
            default:
                return this._validateTypeScript;
        }
    }
}
exports.default = BufferSyncSupport;
