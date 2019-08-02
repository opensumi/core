/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
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
const utils_1 = require("./utils");
class FolderTaskProvider {
    constructor(_workspaceFolder) {
        this._workspaceFolder = _workspaceFolder;
    }
    get workspaceFolder() {
        return this._workspaceFolder;
    }
    isEnabled() {
        return vscode.workspace.getConfiguration('eslint', this._workspaceFolder.uri).get('provideLintTask');
    }
    start() {
    }
    dispose() {
    }
    getTask() {
        return __awaiter(this, void 0, void 0, function* () {
            let rootPath = this._workspaceFolder.uri.scheme === 'file' ? this._workspaceFolder.uri.fsPath : undefined;
            if (!rootPath) {
                return undefined;
            }
            try {
                let command = yield utils_1.findEslint(rootPath);
                let kind = {
                    type: "eslint"
                };
                let options = { cwd: this.workspaceFolder.uri.fsPath };
                return new vscode.Task(kind, this.workspaceFolder, 'lint whole folder', 'eslint', new vscode.ShellExecution(`${command} .`, options), '$eslint-stylish');
            }
            catch (error) {
                return undefined;
            }
        });
    }
}
class TaskProvider {
    constructor() {
        this.providers = new Map();
    }
    start() {
        let folders = vscode.workspace.workspaceFolders;
        if (folders) {
            this.updateWorkspaceFolders(folders, []);
        }
        vscode.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
        vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this);
    }
    dispose() {
        if (this.taskProvider) {
            this.taskProvider.dispose();
            this.taskProvider = undefined;
        }
        this.providers.clear();
    }
    updateWorkspaceFolders(added, removed) {
        for (let remove of removed) {
            let provider = this.providers.get(remove.uri.toString());
            if (provider) {
                provider.dispose();
                this.providers.delete(remove.uri.toString());
            }
        }
        for (let add of added) {
            let provider = new FolderTaskProvider(add);
            if (provider.isEnabled()) {
                this.providers.set(add.uri.toString(), provider);
                provider.start();
            }
        }
        this.updateProvider();
    }
    updateConfiguration() {
        for (let detector of this.providers.values()) {
            if (!detector.isEnabled()) {
                detector.dispose();
                this.providers.delete(detector.workspaceFolder.uri.toString());
            }
        }
        let folders = vscode.workspace.workspaceFolders;
        if (folders) {
            for (let folder of folders) {
                if (!this.providers.has(folder.uri.toString())) {
                    let provider = new FolderTaskProvider(folder);
                    if (provider.isEnabled()) {
                        this.providers.set(folder.uri.toString(), provider);
                        provider.start();
                    }
                }
            }
        }
        this.updateProvider();
    }
    updateProvider() {
        if (!this.taskProvider && this.providers.size > 0) {
            this.taskProvider = vscode.workspace.registerTaskProvider('eslint', {
                provideTasks: () => {
                    return this.getTasks();
                },
                resolveTask(_task) {
                    return undefined;
                }
            });
        }
        else if (this.taskProvider && this.providers.size === 0) {
            this.taskProvider.dispose();
            this.taskProvider = undefined;
        }
    }
    getTasks() {
        if (this.providers.size === 0) {
            return Promise.resolve([]);
        }
        else {
            let promises = [];
            for (let provider of this.providers.values()) {
                promises.push(provider.getTask());
            }
            return Promise.all(promises).then((values) => {
                return values.filter(value => !!value);
            });
        }
    }
}
exports.TaskProvider = TaskProvider;
//# sourceMappingURL=tasks.js.map