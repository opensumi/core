import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as plugin from '../src/plugin';
import * as java from '../src/javaServerStarter';
import * as requirements from '../src/requirements';
import { Commands } from '../src/commands';

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
		return vscode.commands.getCommands(true).then((commands) =>
		{
			const JAVA_COMMANDS = [
				Commands.OPEN_OUTPUT,
				Commands.SHOW_JAVA_REFERENCES,
				Commands.SHOW_JAVA_IMPLEMENTATIONS,
				Commands.CONFIGURATION_UPDATE,
				Commands.IGNORE_INCOMPLETE_CLASSPATH,
				Commands.IGNORE_INCOMPLETE_CLASSPATH_HELP,
				Commands.PROJECT_CONFIGURATION_STATUS,
				Commands.APPLY_WORKSPACE_EDIT,
				Commands.EXECUTE_WORKSPACE_COMMAND,
				Commands.OPEN_SERVER_LOG,
				Commands.COMPILE_WORKSPACE,
				Commands.OPEN_FORMATTER,
				Commands.CLEAN_WORKSPACE,
				Commands.UPDATE_SOURCE_ATTACHMENT,
				Commands.ADD_TO_SOURCEPATH,
				Commands.REMOVE_FROM_SOURCEPATH,
				Commands.LIST_SOURCEPATHS,
				Commands.OVERRIDE_METHODS_PROMPT,
				Commands.HASHCODE_EQUALS_PROMPT,
				Commands.OPEN_JSON_SETTINGS,
				Commands.ORGANIZE_IMPORTS,
				Commands.CHOOSE_IMPORTS,
				Commands.GENERATE_TOSTRING_PROMPT,
				Commands.GENERATE_ACCESSORS_PROMPT,
				Commands.GENERATE_CONSTRUCTORS_PROMPT,
				Commands.GENERATE_DELEGATE_METHODS_PROMPT,
			];
			const foundJavaCommands = commands.filter(function(value) {
				return JAVA_COMMANDS.indexOf(value)>=0 || value.startsWith('java.');
			});
			assert.equal(foundJavaCommands.length , JAVA_COMMANDS.length, 'Some Java commands are not registered properly or a new command is not added to the test');
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
