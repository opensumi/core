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
const neovimValidator_1 = require("../../../src/configuration/validators/neovimValidator");
suite('Neovim Validator', () => {
    test('neovim enabled without path', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        let configuration = new testConfiguration_1.Configuration();
        configuration.enableNeovim = true;
        configuration.neovimPath = '';
        // test
        const validator = new neovimValidator_1.NeovimValidator();
        let actual = yield validator.validate(configuration);
        validator.disable(configuration);
        // assert
        assert.equal(actual.numErrors, 1);
        assert.equal(actual.hasError, true);
        assert.equal(configuration.enableNeovim, false);
    }));
    test('neovim disabled', () => __awaiter(this, void 0, void 0, function* () {
        // setup
        let configuration = new testConfiguration_1.Configuration();
        configuration.enableNeovim = false;
        configuration.neovimPath = '';
        // test
        const validator = new neovimValidator_1.NeovimValidator();
        let actual = yield validator.validate(configuration);
        // assert
        assert.equal(actual.numErrors, 0);
    }));
});

//# sourceMappingURL=neovimValidator.test.js.map
