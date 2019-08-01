"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const plugin = require("../src/plugin");
const java = require("../src/javaServerStarter");
const requirements = require("../src/requirements");
const commands_1 = require("../src/commands");
suite('Java Language Extension', () => {
    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('redhat.java'));
    });
    test('should activate', function () {
        this.timeout(1 * 60 * 1000);
        return vscode.extensions.getExtension('redhat.java').activate().then((api) => {
            assert.ok(true);
        });
    });
    test('should register all java commands', function () {
        return vscode.commands.getCommands(true).then((commands) => {
            const JAVA_COMMANDS = [
                commands_1.Commands.OPEN_OUTPUT,
                commands_1.Commands.SHOW_JAVA_REFERENCES,
                commands_1.Commands.SHOW_JAVA_IMPLEMENTATIONS,
                commands_1.Commands.CONFIGURATION_UPDATE,
                commands_1.Commands.IGNORE_INCOMPLETE_CLASSPATH,
                commands_1.Commands.IGNORE_INCOMPLETE_CLASSPATH_HELP,
                commands_1.Commands.PROJECT_CONFIGURATION_STATUS,
                commands_1.Commands.APPLY_WORKSPACE_EDIT,
                commands_1.Commands.EXECUTE_WORKSPACE_COMMAND,
                commands_1.Commands.OPEN_SERVER_LOG,
                commands_1.Commands.COMPILE_WORKSPACE,
                commands_1.Commands.OPEN_FORMATTER,
                commands_1.Commands.CLEAN_WORKSPACE,
                commands_1.Commands.UPDATE_SOURCE_ATTACHMENT,
                commands_1.Commands.ADD_TO_SOURCEPATH,
                commands_1.Commands.REMOVE_FROM_SOURCEPATH,
                commands_1.Commands.LIST_SOURCEPATHS,
                commands_1.Commands.OVERRIDE_METHODS_PROMPT,
                commands_1.Commands.HASHCODE_EQUALS_PROMPT,
                commands_1.Commands.OPEN_JSON_SETTINGS,
                commands_1.Commands.ORGANIZE_IMPORTS,
                commands_1.Commands.CHOOSE_IMPORTS,
                commands_1.Commands.GENERATE_TOSTRING_PROMPT,
                commands_1.Commands.GENERATE_ACCESSORS_PROMPT,
                commands_1.Commands.GENERATE_CONSTRUCTORS_PROMPT,
                commands_1.Commands.GENERATE_DELEGATE_METHODS_PROMPT,
            ];
            const foundJavaCommands = commands.filter(function (value) {
                return JAVA_COMMANDS.indexOf(value) >= 0 || value.startsWith('java.');
            });
            assert.equal(foundJavaCommands.length, JAVA_COMMANDS.length, 'Some Java commands are not registered properly or a new command is not added to the test');
        });
    });
    test('should parse VM arguments', function () {
        const userArgs = '-Xmx512m -noverify   -Dfoo=\"something with blank\"  ';
        const vmArgs = ['-noverify', 'foo'];
        java.parseVMargs(vmArgs, userArgs);
        assert.equal(4, vmArgs.length);
        assert.equal('-noverify', vmArgs[0]);
        assert.equal('foo', vmArgs[1]);
        assert.equal('-Xmx512m', vmArgs[2]);
        assert.equal('-Dfoo=something with blank', vmArgs[3]);
    });
    test('should parse VM arguments with spaces', function () {
        const userArgs = '-javaagent:"C:\\Program Files\\Java\\lombok.jar" -Xbootclasspath/a:"C:\\Program Files\\Java\\lombok.jar" -Dfoo="Some \\"crazy\\" stuff"';
        const vmArgs = [];
        java.parseVMargs(vmArgs, userArgs);
        assert.equal(vmArgs.length, 3);
        assert.equal(vmArgs[0], '-javaagent:C:\\Program Files\\Java\\lombok.jar');
        assert.equal(vmArgs[1], '-Xbootclasspath/a:C:\\Program Files\\Java\\lombok.jar');
        assert.equal(vmArgs[2], '-Dfoo=Some "crazy" stuff');
    });
    test('should collect java extensions', function () {
        const packageJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '../../test/resources/packageExample.json'), 'utf8'));
        const fakedExtension = {
            id: 'test',
            extensionPath: '',
            isActive: true,
            packageJSON,
            exports: '',
            activate: null
        };
        const extensions = [fakedExtension];
        const result = plugin.collectJavaExtensions(extensions);
        assert(result.length === 1);
        assert(result[0].endsWith(path.normalize('./bin/java.extend.jar')));
    });
    test('should parse Java version', function () {
        // Test boundaries
        assert.equal(requirements.parseMajorVersion(null), 0);
        assert.equal(requirements.parseMajorVersion(''), 0);
        assert.equal(requirements.parseMajorVersion('foo'), 0);
        assert.equal(requirements.parseMajorVersion('version'), 0);
        assert.equal(requirements.parseMajorVersion('version ""'), 0);
        assert.equal(requirements.parseMajorVersion('version "NaN"'), 0);
        // Test the real stuff
        assert.equal(requirements.parseMajorVersion('version "1.7"'), 7);
        assert.equal(requirements.parseMajorVersion('version "1.8.0_151"'), 8);
        assert.equal(requirements.parseMajorVersion('version "9"'), 9);
        assert.equal(requirements.parseMajorVersion('version "9.0.1"'), 9);
        assert.equal(requirements.parseMajorVersion('version "10-ea"'), 10);
    });
});
//# sourceMappingURL=extension.test.js.map