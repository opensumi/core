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
const assert = require("assert");
const modeHandlerMap_1 = require("../../src/mode/modeHandlerMap");
suite('Mode Handler Map', () => {
    setup(() => {
        modeHandlerMap_1.ModeHandlerMap.clear();
    });
    teardown(() => {
        modeHandlerMap_1.ModeHandlerMap.clear();
    });
    test('getOrCreate', () => __awaiter(this, void 0, void 0, function* () {
        // getOrCreate
        let key = Math.random()
            .toString(36)
            .substring(7);
        let [modeHandler, isNew] = yield modeHandlerMap_1.ModeHandlerMap.getOrCreate(key);
        assert.equal(isNew, true);
        assert.notEqual(modeHandler, undefined);
        [, isNew] = yield modeHandlerMap_1.ModeHandlerMap.getOrCreate(key);
        assert.equal(isNew, false);
        // getKeys
        let keys = modeHandlerMap_1.ModeHandlerMap.getKeys();
        assert.equal(keys.length, 1);
        assert.equal(keys[0], key);
        // getAll
        let modeHandlerList = modeHandlerMap_1.ModeHandlerMap.getAll();
        assert.equal(modeHandlerList.length, 1);
        // delete
        modeHandlerMap_1.ModeHandlerMap.delete(key);
        assert.equal(modeHandlerMap_1.ModeHandlerMap.getAll().length, 0);
    }));
});

//# sourceMappingURL=modeHandlerMap.test.js.map
