"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
class CancelledResponse {
    constructor(reason) {
        this.reason = reason;
        this.type = 'cancelled';
    }
}
exports.CancelledResponse = CancelledResponse;
class NoContentResponse {
    constructor() {
        this.type = 'noContent';
    }
}
exports.NoContentResponse = NoContentResponse;
