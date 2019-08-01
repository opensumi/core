"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const error_1 = require("../src/error");
suite('Error', () => {
    test('error code has message', () => {
        /* tslint:disable:forin */
        for (const errorCodeString in error_1.ErrorCode) {
            var errorCode = Number(errorCodeString);
            if (!isNaN(errorCode)) {
                assert.notEqual(error_1.ErrorMessage[errorCode], undefined, errorCodeString);
            }
        }
    });
});

//# sourceMappingURL=error.test.js.map
