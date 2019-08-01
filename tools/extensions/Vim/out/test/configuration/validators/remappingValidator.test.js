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
const testConfiguration_1 = require("../../testConfiguration");
const remappingValidator_1 = require("../../../src/configuration/validators/remappingValidator");
suite('Remapping Validator', () => {
    test('no remappings', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        const configuration = new testConfiguration_1.Configuration();
        configuration.insertModeKeyBindings = [];
        configuration.insertModeKeyBindingsNonRecursive = [];
        configuration.normalModeKeyBindings = [];
        configuration.normalModeKeyBindingsNonRecursive = [];
        configuration.visualModeKeyBindings = [];
        configuration.visualModeKeyBindingsNonRecursive = [];
        // test
        const validator = new remappingValidator_1.RemappingValidator();
        let actual = yield validator.validate(configuration);
        // assert
        assert.equal(actual.numErrors, 0);
        assert.equal(actual.hasError, false);
        assert.equal(actual.numWarnings, 0);
        assert.equal(actual.hasWarning, false);
        assert.equal(configuration.insertModeKeyBindingsMap.size, 0);
        assert.equal(configuration.insertModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsNonRecursiveMap.size, 0);
    }));
    test('jj->esc', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        let configuration = new testConfiguration_1.Configuration();
        configuration.insertModeKeyBindings = [
            {
                before: ['j', 'j'],
                after: ['<Esc>'],
            },
        ];
        configuration.insertModeKeyBindingsNonRecursive = [];
        configuration.normalModeKeyBindings = [];
        configuration.normalModeKeyBindingsNonRecursive = [];
        configuration.visualModeKeyBindings = [];
        configuration.visualModeKeyBindingsNonRecursive = [];
        // test
        const validator = new remappingValidator_1.RemappingValidator();
        let actual = yield validator.validate(configuration);
        // assert
        assert.equal(actual.numErrors, 0);
        assert.equal(actual.hasError, false);
        assert.equal(actual.numWarnings, 0);
        assert.equal(actual.hasWarning, false);
        assert.equal(configuration.insertModeKeyBindingsMap.size, 1);
        assert.equal(configuration.insertModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.insertModeKeyBindingsMap.get('jj'), configuration.insertModeKeyBindings[0]);
    }));
    test('remapping missing after and command', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        let configuration = new testConfiguration_1.Configuration();
        configuration.insertModeKeyBindings = [
            {
                before: ['j', 'j'],
            },
        ];
        configuration.insertModeKeyBindingsNonRecursive = [];
        configuration.normalModeKeyBindings = [];
        configuration.normalModeKeyBindingsNonRecursive = [];
        configuration.visualModeKeyBindings = [];
        configuration.visualModeKeyBindingsNonRecursive = [];
        // test
        const validator = new remappingValidator_1.RemappingValidator();
        let actual = yield validator.validate(configuration);
        // assert
        assert.equal(actual.numErrors, 1);
        assert.equal(actual.hasError, true);
        assert.equal(actual.numWarnings, 0);
        assert.equal(actual.hasWarning, false);
        assert.equal(configuration.insertModeKeyBindingsMap.size, 0);
        assert.equal(configuration.insertModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsNonRecursiveMap.size, 0);
    }));
    test('remappings are de-duped', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        let configuration = new testConfiguration_1.Configuration();
        configuration.insertModeKeyBindings = [];
        configuration.insertModeKeyBindingsNonRecursive = [];
        configuration.normalModeKeyBindings = [
            {
                before: ['c', 'o', 'p', 'y'],
                after: ['c', 'o', 'p', 'y'],
            },
            {
                before: ['c', 'o', 'p', 'y'],
                after: ['c', 'o', 'p', 'y'],
            },
        ];
        configuration.normalModeKeyBindingsNonRecursive = [];
        configuration.visualModeKeyBindings = [];
        configuration.visualModeKeyBindingsNonRecursive = [];
        // test
        const validator = new remappingValidator_1.RemappingValidator();
        let actual = yield validator.validate(configuration);
        // assert
        assert.equal(actual.numErrors, 0);
        assert.equal(actual.hasError, false);
        assert.equal(actual.numWarnings, 1);
        assert.equal(actual.hasWarning, true);
        assert.equal(configuration.insertModeKeyBindingsMap.size, 0);
        assert.equal(configuration.insertModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.normalModeKeyBindingsMap.size, 1);
        assert.equal(configuration.normalModeKeyBindingsNonRecursiveMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsMap.size, 0);
        assert.equal(configuration.visualModeKeyBindingsNonRecursiveMap.size, 0);
    }));
});

//# sourceMappingURL=remappingValidator.test.js.map
