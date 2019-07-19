"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const typeConverters = require("../utils/typeConverters");
class TypeScriptDefinitionProviderBase {
    constructor(client) {
        this.client = client;
    }
    async getSymbolLocations(definitionType, document, position, token) {
        const filepath = this.client.toPath(document.uri);
        if (!filepath) {
            return undefined;
        }
        const args = typeConverters.Position.toFileLocationRequestArgs(filepath, position);
        const response = await this.client.execute(definitionType, args, token);
        if (response.type !== 'response') {
            return undefined;
        }
        const locations = (response && response.body) || [];
        return locations.map(location => typeConverters.Location.fromTextSpan(this.client.toResource(location.file), location));
    }
}
exports.default = TypeScriptDefinitionProviderBase;
