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
const fs = require("fs");
const os = require("os");
const historyFile_1 = require("../../src/history/historyFile");
const testUtils_1 = require("../testUtils");
const configuration_1 = require("../../src/configuration/configuration");
suite('HistoryFile', () => {
    let history;
    let run_cmds;
    const tmpDir = os.tmpdir();
    const assertArrayEquals = (expected, actual) => {
        testUtils_1.assertEqual(expected.length, actual.length);
        for (let i = 0; i < expected.length; i++) {
            testUtils_1.assertEqual(expected[i], actual[i]);
        }
    };
    setup(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.setupWorkspace();
        run_cmds = [];
        for (let i = 0; i < configuration_1.configuration.history; i++) {
            run_cmds.push(i.toString());
        }
        history = new historyFile_1.HistoryFile(testUtils_1.rndName(), tmpDir);
        yield history.load();
    }));
    teardown(() => __awaiter(this, void 0, void 0, function* () {
        yield testUtils_1.cleanUpWorkspace();
        history.clear();
    }));
    test('add command', () => __awaiter(this, void 0, void 0, function* () {
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        assertArrayEquals(run_cmds.slice(), history.get());
    }));
    test('add empty command', () => __awaiter(this, void 0, void 0, function* () {
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        yield history.add('');
        assertArrayEquals(run_cmds.slice(), history.get());
        yield history.add(undefined);
        assertArrayEquals(run_cmds.slice(), history.get());
    }));
    test('add command over configuration.history', () => __awaiter(this, void 0, void 0, function* () {
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        let added_cmd = String(configuration_1.configuration.history);
        run_cmds.push(added_cmd);
        yield history.add(added_cmd);
        assertArrayEquals(run_cmds.slice(1), history.get());
    }));
    test('add command that exists in history', () => __awaiter(this, void 0, void 0, function* () {
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        let existed_cmd = '0';
        yield history.add(existed_cmd);
        let expected_raw_history = run_cmds.slice();
        expected_raw_history.splice(expected_raw_history.indexOf(existed_cmd), 1);
        expected_raw_history.push(existed_cmd);
        assertArrayEquals(expected_raw_history, history.get());
    }));
    test('file system', () => __awaiter(this, void 0, void 0, function* () {
        // history file is lazily created, should not exist
        assert.equal(fs.existsSync(history.historyFilePath), false);
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        // history file should exist after an `add` operation
        assert.equal(fs.existsSync(history.historyFilePath), true);
        history.clear();
        // expect history file to be deleted from file system and empty
        assert.equal(fs.existsSync(history.historyFilePath), false);
    }));
    test('change configuration.history', () => __awaiter(this, void 0, void 0, function* () {
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        assert.equal(history.get().length, configuration_1.configuration.history);
        configuration_1.configuration.history = 10;
        for (let cmd of run_cmds) {
            yield history.add(cmd);
        }
        assertArrayEquals(run_cmds.slice(run_cmds.length - configuration_1.configuration.history), history.get());
    }));
});

//# sourceMappingURL=historyFile.test.js.map
