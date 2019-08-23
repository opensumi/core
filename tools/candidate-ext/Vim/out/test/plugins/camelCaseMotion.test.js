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
const testSimplifier_1 = require("../testSimplifier");
const testUtils_1 = require("./../testUtils");
const testConfiguration_1 = require("../testConfiguration");
const { newTest } = testSimplifier_1.getTestingFunctions();
suite('camelCaseMotion plugin if not enabled', () => {
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const configuration = new testConfiguration_1.Configuration();
        configuration.camelCaseMotion.enable = false;
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    newTest({
        title: "basic motion doesn't work",
        start: ['|camelWord'],
        keysPressed: '<leader>w',
        end: ['|camelWord'],
    });
});
suite('camelCaseMotion plugin', () => {
    setup(() => __awaiter(this, void 0, void 0, function* () {
        const configuration = new testConfiguration_1.Configuration();
        configuration.camelCaseMotion.enable = true;
        yield testUtils_1.setupWorkspace(configuration);
    }));
    teardown(testUtils_1.cleanUpWorkspace);
    suite('handles <leader>w for camelCaseText', () => {
        newTest({
            title: 'step over whitespace',
            start: ['|var testCamelVARWithNums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var |testCamelVARWithNums555&&&Ops'],
        });
        newTest({
            title: 'step to Camel word',
            start: ['var |testCamelVARWithNums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var test|CamelVARWithNums555&&&Ops'],
        });
        newTest({
            title: 'step to CAP word',
            start: ['var test|CamelVARWithNums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamel|VARWithNums555&&&Ops'],
        });
        newTest({
            title: 'step after CAP word',
            start: ['var testCamel|VARWithNums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamelVAR|WithNums555&&&Ops'],
        });
        newTest({
            title: 'step from middle of word to Camel word',
            start: ['var testCamelVARW|ithNums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamelVARWith|Nums555&&&Ops'],
        });
        newTest({
            title: 'step to number word',
            start: ['var testCamelVARWith|Nums555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamelVARWithNums|555&&&Ops'],
        });
        newTest({
            title: 'step to operator word',
            start: ['var testCamelVARWithNums|555&&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamelVARWithNums555|&&&Ops'],
        });
        newTest({
            title: 'step from inside operator word',
            start: ['var testCamelVARWithNums555&|&&Ops'],
            keysPressed: '<leader>w',
            end: ['var testCamelVARWithNums555&&&|Ops'],
        });
        newTest({
            title: 'step to operator and then over',
            start: ['|camel.camelWord'],
            keysPressed: '2<leader>w',
            end: ['camel.|camelWord'],
        });
    });
    suite('handles <leader>w for underscore_var', () => {
        newTest({
            title: 'step to _word',
            start: ['|some_var and_other23_var'],
            keysPressed: '<leader>w',
            end: ['some|_var and_other23_var'],
        });
        newTest({
            title: 'step over whitespace to word',
            start: ['some|_var and_other23_var'],
            keysPressed: '<leader>w',
            end: ['some_var |and_other23_var'],
        });
        newTest({
            title: 'step from inside word to _word',
            start: ['some_var a|nd_other23_var'],
            keysPressed: '<leader>w',
            end: ['some_var and|_other23_var'],
        });
        newTest({
            title: 'step form _word to number',
            start: ['some_var and|_other23_var'],
            keysPressed: '<leader>w',
            end: ['some_var and_other|23_var'],
        });
        newTest({
            title: 'step from nubmer word to _word',
            start: ['some_var and_other2|3_var'],
            keysPressed: '<leader>w',
            end: ['some_var and_other23|_var'],
        });
        newTest({
            title: 'step from in whitespace to word',
            start: ['variable  |  more_vars'],
            keysPressed: '<leader>w',
            end: ['variable    |more_vars'],
        });
        newTest({
            title: 'step in ALL_CAPS_WORD',
            start: ['A|LL_CAPS_WORD'],
            keysPressed: '2<leader>w',
            end: ['ALL_CAPS|_WORD'],
        });
    });
    suite('handles d<leader>w', () => {
        newTest({
            title: 'delete from start of camelWord',
            start: ['|camelTwoWord'],
            keysPressed: 'd<leader>w',
            end: ['|TwoWord'],
        });
        newTest({
            title: 'delete from middle of camelWord',
            start: ['ca|melTwoWord'],
            keysPressed: 'd<leader>w',
            end: ['ca|TwoWord'],
        });
        newTest({
            title: 'delete from start of CamelWord',
            start: ['camel|TwoWord'],
            keysPressed: 'd<leader>w',
            end: ['camel|Word'],
        });
        newTest({
            title: 'delete two words from camelWord',
            start: ['ca|melTwoWord'],
            keysPressed: '2d<leader>w',
            end: ['ca|Word'],
        });
        newTest({
            title: 'delete from start of underscore_word',
            start: ['|camel_two_word'],
            keysPressed: 'd<leader>w',
            end: ['|_two_word'],
        });
        newTest({
            title: 'delete from middle of underscore_word',
            start: ['ca|mel_two_word'],
            keysPressed: 'd<leader>w',
            end: ['ca|_two_word'],
        });
        newTest({
            title: 'delete two words from camel_word',
            start: ['ca|mel_two_word'],
            keysPressed: '2d<leader>w',
            end: ['ca|_word'],
        });
    });
    suite('handles di<leader>w', () => {
        newTest({
            title: 'delete from start of camelWord',
            start: ['|camelTwoWord'],
            keysPressed: 'di<leader>w',
            end: ['|TwoWord'],
        });
        newTest({
            title: 'delete from middle of camelWord',
            start: ['ca|melTwoWord'],
            keysPressed: 'di<leader>w',
            end: ['|TwoWord'],
        });
        newTest({
            title: 'delete from start of CamelWord',
            start: ['camel|TwoWord'],
            keysPressed: 'di<leader>w',
            end: ['camel|Word'],
        });
        newTest({
            title: 'delete two words from camelWord',
            start: ['ca|melTwoWord'],
            keysPressed: '2di<leader>w',
            end: ['|Word'],
        });
        newTest({
            title: 'delete from start of underscore_word',
            start: ['|camel_two_word'],
            keysPressed: 'di<leader>w',
            end: ['|_two_word'],
        });
        newTest({
            title: 'delete from middle of underscore_word',
            start: ['ca|mel_two_word'],
            keysPressed: 'di<leader>w',
            end: ['|_two_word'],
        });
        newTest({
            title: 'delete two words from camel_word',
            start: ['ca|mel_two_word'],
            keysPressed: '2di<leader>w',
            end: ['|_word'],
        });
    });
    suite('handles <leader>b', () => {
        newTest({
            title: 'back from middle of word',
            start: ['camel.camelWord oth|er'],
            keysPressed: '<leader>b',
            end: ['camel.camelWord |other'],
        });
        newTest({
            title: 'back over whitespace to camelWord',
            start: ['camel.camelWord |other'],
            keysPressed: '<leader>b',
            end: ['camel.camel|Word other'],
        });
        newTest({
            title: 'back twice over operator',
            start: ['camel.camel|Word other'],
            keysPressed: '2<leader>b',
            end: ['camel|.camelWord other'],
        });
    });
    suite('handles <leader>e', () => {
        newTest({
            title: 'from start to middle of underscore_word',
            start: ['|foo_bar && camelCase'],
            keysPressed: '<leader>e',
            end: ['fo|o_bar && camelCase'],
        });
        newTest({
            title: 'from middle to end of underscore_word',
            start: ['fo|o_bar && camelCase'],
            keysPressed: '<leader>e',
            end: ['foo_ba|r && camelCase'],
        });
        newTest({
            title: 'twice to end of word over operator',
            start: ['foo_ba|r && camelCase'],
            keysPressed: '2<leader>e',
            end: ['foo_bar && came|lCase'],
        });
    });
});

//# sourceMappingURL=camelCaseMotion.test.js.map
