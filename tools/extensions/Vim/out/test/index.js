"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
//
// PLEASE DO NOT MODIFY / DELETE UNLESS YOU KNOW WHAT YOU ARE DOING
//
// This file is providing the test runner to use when running extension tests.
// By default the test runner in use is Mocha based.
//
// You can provide your own test runner if you want to override it by exporting
// a function run(testRoot: string, clb: (error:Error) => void) that the extension
// host can call to run the tests. The test runner is expected to use console.log
// to report the results back to the caller. When the tests are finished, return
// a possible error to the callback or null if none.
const globals_1 = require("../src/globals");
const testConfiguration_1 = require("./testConfiguration");
globals_1.Globals.isTesting = true;
globals_1.Globals.mockConfiguration = new testConfiguration_1.Configuration();
// See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically#set-options for more info
var testRunner = require('vscode/lib/testrunner');
// create new RegExp to catch errors early, ie before passing it to mocha
const mochaGrep = new RegExp(process.env.MOCHA_GREP || '');
const testRunnerConfiguration = {
    ui: 'tdd',
    useColors: true,
    timeout: 10000,
    grep: mochaGrep,
};
testRunner.configure(testRunnerConfiguration);
module.exports = testRunner;

//# sourceMappingURL=index.js.map
