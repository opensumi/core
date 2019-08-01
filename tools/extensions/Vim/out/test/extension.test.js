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
const _ = require("lodash");
const vscode = require("vscode");
const srcConfiguration = require("../src/configuration/configuration");
const testConfiguration = require("./testConfiguration");
suite('package.json', () => {
    let pkg;
    suiteSetup(() => {
        pkg = require(__dirname + '/../../package.json');
        assert.ok(pkg);
    });
    test('all keys have handlers', () => __awaiter(this, void 0, void 0, function* () {
        let registeredCommands = yield vscode.commands.getCommands();
        let keybindings = pkg.contributes.keybindings;
        assert.ok(keybindings);
        for (let i = 0; i < keybindings.length; i++) {
            let keybinding = keybindings[i];
            var found = registeredCommands.indexOf(keybinding.command) >= -1;
            assert.ok(found, 'Missing handler for key=' + keybinding.key + '. Expected handler=' + keybinding.command);
        }
    }));
    test('all defined configurations in package.json have handlers', () => __awaiter(this, void 0, void 0, function* () {
        // package.json
        let pkgConfigurations = pkg.contributes.configuration.properties;
        assert.ok(pkgConfigurations);
        let keys = Object.keys(pkgConfigurations);
        assert.notEqual(keys.length, 0);
        // configuration
        let handlers = Object.keys(srcConfiguration.configuration);
        let unhandled = _.filter(keys, k => {
            return handlers.indexOf(k) >= 0;
        });
        assert.equal(unhandled, 0, 'Missing src handlers for ' + unhandled.join(','));
        // test configuration
        handlers = Object.keys(new testConfiguration.Configuration());
        unhandled = _.filter(keys, k => {
            return handlers.indexOf(k) >= 0;
        });
        assert.equal(unhandled, 0, 'Missing test handlers for ' + unhandled.join(','));
    }));
});

//# sourceMappingURL=extension.test.js.map
