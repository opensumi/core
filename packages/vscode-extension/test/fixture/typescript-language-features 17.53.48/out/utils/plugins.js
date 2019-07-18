"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const dispose_1 = require("./dispose");
const memoize_1 = require("./memoize");
class PluginManager extends dispose_1.Disposable {
    constructor() {
        super(...arguments);
        this._pluginConfigurations = new Map();
        this._onDidUpdateConfig = this._register(new vscode.EventEmitter());
        this.onDidUpdateConfig = this._onDidUpdateConfig.event;
    }
    get plugins() {
        const plugins = [];
        for (const extension of vscode.extensions.all) {
            const pack = extension.packageJSON;
            if (pack.contributes && Array.isArray(pack.contributes.typescriptServerPlugins)) {
                for (const plugin of pack.contributes.typescriptServerPlugins) {
                    plugins.push({
                        name: plugin.name,
                        path: extension.extensionPath,
                        languages: Array.isArray(plugin.languages) ? plugin.languages : [],
                    });
                }
            }
        }
        return plugins;
    }
    setConfiguration(pluginId, config) {
        this._pluginConfigurations.set(pluginId, config);
        this._onDidUpdateConfig.fire({ pluginId, config });
    }
    configurations() {
        return this._pluginConfigurations.entries();
    }
}
__decorate([
    memoize_1.memoize
], PluginManager.prototype, "plugins", null);
exports.PluginManager = PluginManager;
