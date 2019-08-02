/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as path from 'path';
import * as fs from 'fs';
import {
	workspace as Workspace, window as Window, commands as Commands, languages as Languages, Disposable, ExtensionContext, Uri, StatusBarAlignment, TextDocument,
	CodeActionContext, Diagnostic, ProviderResult, Command, QuickPickItem, WorkspaceFolder as VWorkspaceFolder, CodeAction, MessageItem
} from 'vscode';
import {
	LanguageClient, LanguageClientOptions, RequestType, TransportKind,
	TextDocumentIdentifier, NotificationType, ErrorHandler,
	ErrorAction, CloseAction, State as ClientState,
	RevealOutputChannelOn, VersionedTextDocumentIdentifier, ExecuteCommandRequest, ExecuteCommandParams,
	ServerOptions, DocumentFilter, DidCloseTextDocumentNotification, DidOpenTextDocumentNotification,
	WorkspaceFolder
} from 'vscode-languageclient';

import { findEslint } from './utils';
import { TaskProvider } from './tasks';

namespace Is {
	const toString = Object.prototype.toString;

	export function boolean(value: any): value is boolean {
		return value === true || value === false;
	}

	export function string(value: any): value is string {
		return toString.call(value) === '[object String]';
	}
}

interface ValidateItem {
	language: string;
	autoFix?: boolean;
}

namespace ValidateItem {
	export function is(item: any): item is ValidateItem {
		let candidate = item as ValidateItem;
		return candidate && Is.string(candidate.language) && (Is.boolean(candidate.autoFix) || candidate.autoFix === void 0);
	}
}

interface DirectoryItem {
	directory: string;
	changeProcessCWD?: boolean;
}

namespace DirectoryItem {
	export function is(item: any): item is DirectoryItem {
		let candidate = item as DirectoryItem;
		return candidate && Is.string(candidate.directory) && (Is.boolean(candidate.changeProcessCWD) || candidate.changeProcessCWD === void 0);
	}
}

type RunValues = 'onType' | 'onSave';

interface CodeActionSettings {
	disableRuleComment: {
		enable: boolean;
		location: 'separateLine' | 'sameLine';
	};
	showDocumentation: {
		enable: boolean;
	};
}

interface TextDocumentSettings {
	validate: boolean;
	packageManager: 'npm' | 'yarn' | 'pnpm';
	autoFix: boolean;
	autoFixOnSave: boolean;
	quiet: boolean;
	options: any | undefined;
	run: RunValues;
	nodePath: string | undefined;
	workspaceFolder: WorkspaceFolder | undefined;
	workingDirectory: DirectoryItem | undefined;
	library: undefined;
	codeAction: CodeActionSettings;
}

interface NoESLintState {
	global?: boolean;
	workspaces?: { [key: string]: boolean };
}

enum Status {
	ok = 1,
	warn = 2,
	error = 3
}

interface StatusParams {
	state: Status;
}

namespace StatusNotification {
	export const type = new NotificationType<StatusParams, void>('eslint/status');
}

interface NoConfigParams {
	message: string;
	document: TextDocumentIdentifier;
}

interface NoConfigResult {
}

namespace NoConfigRequest {
	export const type = new RequestType<NoConfigParams, NoConfigResult, void, void>('eslint/noConfig');
}


interface NoESLintLibraryParams {
	source: TextDocumentIdentifier;
}

interface NoESLintLibraryResult {
}

namespace NoESLintLibraryRequest {
	export const type = new RequestType<NoESLintLibraryParams, NoESLintLibraryResult, void, void>('eslint/noLibrary');
}

interface OpenESLintDocParams {
	url: string;
}

interface OpenESLintDocResult {

}

namespace OpenESLintDocRequest {
	export const type = new RequestType<OpenESLintDocParams, OpenESLintDocResult, void, void>('eslint/openDoc');
}

const exitCalled = new NotificationType<[number, string], void>('eslint/exitCalled');


interface WorkspaceFolderItem extends QuickPickItem {
	folder: VWorkspaceFolder;
}

function pickFolder(folders: VWorkspaceFolder[], placeHolder: string): Thenable<VWorkspaceFolder> {
	if (folders.length === 1) {
		return Promise.resolve(folders[0]);
	}
	return Window.showQuickPick(
		folders.map<WorkspaceFolderItem>((folder) => { return { label: folder.name, description: folder.uri.fsPath, folder: folder }; }),
		{ placeHolder: placeHolder }
	).then((selected) => {
		if (!selected) {
			return undefined;
		}
		return selected.folder;
	});
}

function enable() {
	let folders = Workspace.workspaceFolders;
	if (!folders) {
		Window.showWarningMessage('ESLint can only be enabled if VS Code is opened on a workspace folder.');
		return;
	}
	let disabledFolders = folders.filter(folder => !Workspace.getConfiguration('eslint',folder.uri).get('enable', true));
	if (disabledFolders.length === 0) {
		if (folders.length === 1) {
			Window.showInformationMessage('ESLint is already enabled in the workspace.');
		} else {
			Window.showInformationMessage('ESLint is already enabled on all workspace folders.');
		}
		return;
	}
	pickFolder(disabledFolders, 'Select a workspace folder to enable ESLint for').then(folder => {
		if (!folder) {
			return;
		}
		Workspace.getConfiguration('eslint', folder.uri).update('enable', true);
	});
}

function disable() {
	let folders = Workspace.workspaceFolders;
	if (!folders) {
		Window.showErrorMessage('ESLint can only be disabled if VS Code is opened on a workspace folder.');
		return;
	}
	let enabledFolders = folders.filter(folder => Workspace.getConfiguration('eslint',folder.uri).get('enable', true));
	if (enabledFolders.length === 0) {
		if (folders.length === 1) {
			Window.showInformationMessage('ESLint is already disabled in the workspace.');
		} else {
			Window.showInformationMessage('ESLint is already disabled on all workspace folders.');
		}
		return;
	}
	pickFolder(enabledFolders, 'Select a workspace folder to disable ESLint for').then(folder => {
		if (!folder) {
			return;
		}
		Workspace.getConfiguration('eslint', folder.uri).update('enable', false);
	});
}

function createDefaultConfiguration(): void {
	let folders = Workspace.workspaceFolders;
	if (!folders) {
		Window.showErrorMessage('An ESLint configuration can only be generated if VS Code is opened on a workspace folder.');
		return;
	}
	let noConfigFolders = folders.filter(folder => {
		let configFiles = ['.eslintrc.js', '.eslintrc.yaml', '.eslintrc.yml', '.eslintrc', '.eslintrc.json'];
		for (let configFile of configFiles) {
			if (fs.existsSync(path.join(folder.uri.fsPath, configFile))) {
				return false;
			}
		}
		return true;
	});
	if (noConfigFolders.length === 0) {
		if (folders.length === 1) {
			Window.showInformationMessage('The workspace already contains an ESLint configuration file.');
		} else {
			Window.showInformationMessage('All workspace folders already contain an ESLint configuration file.');
		}
		return;
	}
	pickFolder(noConfigFolders, 'Select a workspace folder to generate a ESLint configuration for').then(async (folder) => {
		if (!folder) {
			return;
		}
		const folderRootPath = folder.uri.fsPath;
		const terminal = Window.createTerminal({
			name: `ESLint init`,
			cwd: folderRootPath
		});
		const eslintCommand = await findEslint(folderRootPath);
		terminal.sendText(`${eslintCommand} --init`);
		terminal.show();
	});
}

let dummyCommands: Disposable[];

let defaultLanguages = ['javascript', 'javascriptreact'];
function shouldBeValidated(textDocument: TextDocument): boolean {
	let config = Workspace.getConfiguration('eslint', textDocument.uri);
	if (!config.get('enable', true)) {
		return false;
	}
	let validate = config.get<(ValidateItem | string)[]>('validate', defaultLanguages);
	for (let item of validate) {
		if (Is.string(item) && item === textDocument.languageId) {
			return true;
		} else if (ValidateItem.is(item) && item.language === textDocument.languageId) {
			return true;
		}
	}
	return false;
}

let taskProvider: TaskProvider;
export function activate(context: ExtensionContext) {
	let activated: boolean;
	let openListener: Disposable;
	let configurationListener: Disposable;
	function didOpenTextDocument(textDocument: TextDocument) {
		if (activated) {
			return;
		}
		if (shouldBeValidated(textDocument)) {
			openListener.dispose();
			configurationListener.dispose();
			activated = true;
			realActivate(context);
		}
	}
	function configurationChanged() {
		if (activated) {
			return;
		}
		for (let textDocument of Workspace.textDocuments) {
			if (shouldBeValidated(textDocument)) {
				openListener.dispose();
				configurationListener.dispose();
				activated = true;
				realActivate(context);
				return;
			}
		}
	}
	openListener = Workspace.onDidOpenTextDocument(didOpenTextDocument);
	configurationListener = Workspace.onDidChangeConfiguration(configurationChanged);

	let notValidating = () => Window.showInformationMessage('ESLint is not running. By default only JavaScript files are validated. If you want to validate other file types please specify them in the \'eslint.validate\' setting.');
	dummyCommands = [
		Commands.registerCommand('eslint.executeAutofix', notValidating),
		Commands.registerCommand('eslint.showOutputChannel', notValidating)
	];

	context.subscriptions.push(
		Commands.registerCommand('eslint.createConfig', createDefaultConfiguration),
		Commands.registerCommand('eslint.enable', enable),
		Commands.registerCommand('eslint.disable', disable)
	);
	taskProvider = new TaskProvider();
	taskProvider.start();
	configurationChanged();
}

export function realActivate(context: ExtensionContext): void {

	let statusBarItem = Window.createStatusBarItem(StatusBarAlignment.Right, 0);
	let eslintStatus: Status = Status.ok;
	let serverRunning: boolean = false;

	statusBarItem.text = 'ESLint';
	statusBarItem.command = 'eslint.showOutputChannel';

	function showStatusBarItem(show: boolean): void {
		if (show) {
			statusBarItem.show();
		} else {
			statusBarItem.hide();
		}
	}

	function updateStatus(status: Status) {
		eslintStatus = status;
		switch (status) {
			case Status.ok:
				statusBarItem.text = 'ESLint';
				break;
			case Status.warn:
				statusBarItem.text = '$(alert) ESLint';
				break;
			case Status.error:
				statusBarItem.text = '$(issue-opened) ESLint';
				break;
			default:
				statusBarItem.text = 'ESLint';
		}
		updateStatusBarVisibility();
	}

	function updateStatusBarVisibility(): void {
		showStatusBarItem(
			(serverRunning && eslintStatus !== Status.ok) || Workspace.getConfiguration('eslint').get('alwaysShowStatus', false)
		);
	}

	// We need to go one level up since an extension compile the js code into
	// the output folder.
	// serverModule
	let serverModule = context.asAbsolutePath(path.join('server', 'out', 'eslintServer.js'));
	let runtime = Workspace.getConfiguration('eslint').get('runtime', null);
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc, runtime, options: { cwd: process.cwd() } },
		debug: { module: serverModule, transport: TransportKind.ipc, runtime, options: { execArgv: ["--nolazy", "--inspect=6010"], cwd: process.cwd() } }
	};

	let defaultErrorHandler: ErrorHandler;
	let serverCalledProcessExit: boolean = false;

	let packageJsonFilter: DocumentFilter = { scheme: 'file', pattern: '**/package.json'};
	let configFileFilter: DocumentFilter = { scheme: 'file', pattern: '**/.eslintr{c.js,c.yaml,c.yml,c,c.json}'};
	let syncedDocuments: Map<string, TextDocument> = new Map<string, TextDocument>();

	Workspace.onDidChangeConfiguration(() => {
		for (let textDocument of syncedDocuments.values()) {
			if (!shouldBeValidated(textDocument)) {
				syncedDocuments.delete(textDocument.uri.toString());
				client.sendNotification(DidCloseTextDocumentNotification.type, client.code2ProtocolConverter.asCloseTextDocumentParams(textDocument));
			}
		}
		for (let textDocument of Workspace.textDocuments) {
			if (!syncedDocuments.has(textDocument.uri.toString()) && shouldBeValidated(textDocument)) {
				client.sendNotification(DidOpenTextDocumentNotification.type, client.code2ProtocolConverter.asOpenTextDocumentParams(textDocument));
				syncedDocuments.set(textDocument.uri.toString(), textDocument);
			}
		}
	});
	let clientOptions: LanguageClientOptions = {
		documentSelector: [{ scheme: 'file' }, { scheme: 'untitled'}],
		diagnosticCollectionName: 'eslint',
		revealOutputChannelOn: RevealOutputChannelOn.Never,
		synchronize: {
			// configurationSection: 'eslint',
			fileEvents: [
				Workspace.createFileSystemWatcher('**/.eslintr{c.js,c.yaml,c.yml,c,c.json}'),
				Workspace.createFileSystemWatcher('**/.eslintignore'),
				Workspace.createFileSystemWatcher('**/package.json')
			]
		},
		initializationFailedHandler: (error) => {
			client.error('Server initialization failed.', error);
			client.outputChannel.show(true);
			return false;
		},
		errorHandler: {
			error: (error, message, count): ErrorAction => {
				return defaultErrorHandler.error(error, message, count);
			},
			closed: (): CloseAction => {
				if (serverCalledProcessExit) {
					return CloseAction.DoNotRestart;
				}
				return defaultErrorHandler.closed();
			}
		},
		middleware: {
			didOpen: (document, next) => {
				if (Languages.match(packageJsonFilter, document) || Languages.match(configFileFilter, document) || shouldBeValidated(document)) {
					next(document);
					syncedDocuments.set(document.uri.toString(), document);
					return;
				}
			},
			didChange: (event, next) => {
				if (syncedDocuments.has(event.document.uri.toString())) {
					next(event);
				}
			},
			willSave: (event, next) => {
				if (syncedDocuments.has(event.document.uri.toString())) {
					next(event);
				}
			},
			willSaveWaitUntil: (event, next) => {
				if (syncedDocuments.has(event.document.uri.toString())) {
					return next(event);
				} else {
					return Promise.resolve([]);
				}
			},
			didSave: (document, next) => {
				if (syncedDocuments.has(document.uri.toString())) {
					next(document);
				}
			},
			didClose: (document, next) => {
				let uri = document.uri.toString();
				if (syncedDocuments.has(uri)) {
					syncedDocuments.delete(uri);
					next(document);
				}
			},
			provideCodeActions: (document, range, context, token, next): ProviderResult<(Command | CodeAction)[]> => {
				if (!syncedDocuments.has(document.uri.toString()) || !context.diagnostics || context.diagnostics.length === 0) {
					return [];
				}
				let eslintDiagnostics: Diagnostic[] = [];
				for (let diagnostic of context.diagnostics) {
					if (diagnostic.source === 'eslint') {
						eslintDiagnostics.push(diagnostic);
					}
				}
				if (eslintDiagnostics.length === 0) {
					return [];
				}
				let newContext: CodeActionContext = Object.assign({}, context, { diagnostics: eslintDiagnostics } as CodeActionContext);
				return next(document, range, newContext, token);
			},
			workspace: {
				configuration: (params, _token, _next): any[] => {
					if (!params.items) {
						return null;
					}
					let result: (TextDocumentSettings | null)[] = [];
					for (let item of params.items) {
						if (item.section || !item.scopeUri) {
							result.push(null);
							continue;
						}
						let resource = client.protocol2CodeConverter.asUri(item.scopeUri);
						let config = Workspace.getConfiguration('eslint', resource);
						let settings: TextDocumentSettings = {
							validate: false,
							packageManager: config.get('packageManager', 'npm'),
							autoFix: false,
							autoFixOnSave: false,
							quiet: config.get('quiet', false),
							options: config.get('options', {}),
							run: config.get('run', 'onType'),
							nodePath: config.get('nodePath', undefined),
							workingDirectory: undefined,
							workspaceFolder: undefined,
							library: undefined,
							codeAction: {
								disableRuleComment: config.get('codeAction.disableRuleComment', { enable: true, location: 'separateLine' as 'separateLine' }),
								showDocumentation: config.get('codeAction.showDocumentation', { enable: true })
							}
						};
						let document: TextDocument = syncedDocuments.get(item.scopeUri);
						if (!document) {
							result.push(settings);
							continue;
						}
						if (config.get('enabled', true)) {
							let validateItems = config.get<(ValidateItem | string)[]>('validate', ['javascript', 'javascriptreact']);
							for (let item of validateItems) {
								if (Is.string(item) && item === document.languageId) {
									settings.validate = true;
									if (item === 'javascript' || item === 'javascriptreact') {
										settings.autoFix = true;
									}
									break;
								}
								else if (ValidateItem.is(item) && item.language === document.languageId) {
									settings.validate = true;
									settings.autoFix = item.autoFix;
									break;
								}
							}
						}
						if (settings.validate) {
							settings.autoFixOnSave = settings.autoFix && config.get('autoFixOnSave', false);
						}
						let workspaceFolder = Workspace.getWorkspaceFolder(resource);
						if (workspaceFolder) {
							settings.workspaceFolder = {
								name: workspaceFolder.name,
								uri: client.code2ProtocolConverter.asUri(workspaceFolder.uri)
							};
						}
						let workingDirectories = config.get<(string | DirectoryItem)[]>('workingDirectories', undefined);
						if (Array.isArray(workingDirectories)) {
							let workingDirectory = undefined;
							let workspaceFolderPath = workspaceFolder && workspaceFolder.uri.scheme === 'file' ? workspaceFolder.uri.fsPath : undefined;
							for (let entry of workingDirectories) {
								let directory;
								let changeProcessCWD = false;
								if (Is.string(entry)) {
									directory = entry;
								}
								else if (DirectoryItem.is(entry)) {
									directory = entry.directory;
									changeProcessCWD = !!entry.changeProcessCWD;
								}
								if (directory) {
									if (path.isAbsolute(directory)) {
										directory = directory;
									}
									else if (workspaceFolderPath && directory) {
										directory = path.join(workspaceFolderPath, directory);
									}
									else {
										directory = undefined;
									}
									let filePath = document.uri.scheme === 'file' ? document.uri.fsPath : undefined;
									if (filePath && directory && filePath.startsWith(directory)) {
										if (workingDirectory) {
											if (workingDirectory.directory.length < directory.length) {
												workingDirectory.directory = directory;
												workingDirectory.changeProcessCWD = changeProcessCWD;
											}
										}
										else {
											workingDirectory = { directory, changeProcessCWD };
										}
									}
								}
							}
							settings.workingDirectory = workingDirectory;
						}
						result.push(settings);
					}
					return result;
				}
			}
		}
	};

	let client: LanguageClient;
	try {
		client = new LanguageClient('ESLint', serverOptions, clientOptions);
	} catch (err) {
		Window.showErrorMessage(`The ESLint extension couldn't be started. See the ESLint output channel for details.`);
		return;
	}
	client.registerProposedFeatures();
	defaultErrorHandler = client.createDefaultErrorHandler();
	const running = 'ESLint server is running.';
	const stopped = 'ESLint server stopped.';
	client.onDidChangeState((event) => {
		if (event.newState === ClientState.Running) {
			client.info(running);
			statusBarItem.tooltip = running;
			serverRunning = true;
		} else {
			client.info(stopped);
			statusBarItem.tooltip = stopped;
			serverRunning = false;
		}
		updateStatusBarVisibility();
	});
	client.onReady().then(() => {
		client.onNotification(StatusNotification.type, (params) => {
			updateStatus(params.state);
		});

		client.onNotification(exitCalled, (params) => {
			serverCalledProcessExit = true;
			client.error(`Server process exited with code ${params[0]}. This usually indicates a misconfigured ESLint setup.`, params[1]);
			Window.showErrorMessage(`ESLint server shut down itself. See 'ESLint' output channel for details.`);
		});

		client.onRequest(NoConfigRequest.type, (params) => {
			let document = Uri.parse(params.document.uri);
			let workspaceFolder = Workspace.getWorkspaceFolder(document);
			let fileLocation = document.fsPath;
			if (workspaceFolder) {
				client.warn([
					'',
					`No ESLint configuration (e.g .eslintrc) found for file: ${fileLocation}`,
					`File will not be validated. Consider running 'eslint --init' in the workspace folder ${workspaceFolder.name}`,
					`Alternatively you can disable ESLint by executing the 'Disable ESLint' command.`
				].join('\n'));
			} else {
				client.warn([
					'',
					`No ESLint configuration (e.g .eslintrc) found for file: ${fileLocation}`,
					`File will not be validated. Alternatively you can disable ESLint by executing the 'Disable ESLint' command.`
				].join('\n'));
			}
			eslintStatus = Status.warn;
			updateStatusBarVisibility();
			return {};
		});

		client.onRequest(NoESLintLibraryRequest.type, (params) => {
			const key = 'noESLintMessageShown';
			let state = context.globalState.get<NoESLintState>(key, {});
			let uri: Uri = Uri.parse(params.source.uri);
			let workspaceFolder = Workspace.getWorkspaceFolder(uri);
			const packageManager = Workspace.getConfiguration('eslint', uri).get('packageManager', 'npm');
			const localInstall = {
				npm: 'npm install eslint',
				pnpm: 'pnpm install eslint',
				yarn: 'yarn add eslint',
			};
			const globalInstall = {
				npm: 'npm install -g eslint',
				pnpm: 'pnpm install -g eslint',
				yarn: 'yarn global add eslint'
			};
			const isPackageManagerNpm = packageManager === 'npm';
			interface ButtonItem extends MessageItem {
				id: number;
			}
			const outputItem: ButtonItem = {
				title: 'Go to output',
				id: 1
			};
			if (workspaceFolder) {
				client.info([
					'',
					`Failed to load the ESLint library for the document ${uri.fsPath}`,
					'',
					`To use ESLint please install eslint by running ${localInstall[packageManager]} in the workspace folder ${workspaceFolder.name}`,
					`or globally using '${globalInstall[packageManager]}'. You need to reopen the workspace after installing eslint.`,
					'',
					isPackageManagerNpm ? 'If you are using yarn or pnpm instead of npm set the setting `eslint.packageManager` to either `yarn` or `pnpm`' : null,
					`Alternatively you can disable ESLint for the workspace folder ${workspaceFolder.name} by executing the 'Disable ESLint' command.`
				].filter((str=>(str !== null))).join('\n'));

				if (!state.workspaces) {
					state.workspaces = Object.create(null);
				}
				if (!state.workspaces[workspaceFolder.uri.toString()]) {
					state.workspaces[workspaceFolder.uri.toString()] = true;
					context.globalState.update(key, state);
					Window.showInformationMessage(`Failed to load the ESLint library for the document ${uri.fsPath}. See the output for more information.`, outputItem).then((item) => {
						if (item && item.id === 1) {
							client.outputChannel.show(true);
						}
					});
				}
			} else {
				client.info([
					`Failed to load the ESLint library for the document ${uri.fsPath}`,
					`To use ESLint for single JavaScript file install eslint globally using '${globalInstall[packageManager]}'.`,
					isPackageManagerNpm ? 'If you are using yarn or pnpm instead of npm set the setting `eslint.packageManager` to either `yarn` or `pnpm`' : null,
					'You need to reopen VS Code after installing eslint.',
				].filter((str=>(str !== null))).join('\n'));

				if (!state.global) {
					state.global = true;
					context.globalState.update(key, state);
					Window.showInformationMessage(`Failed to load the ESLint library for the document ${uri.fsPath}. See the output for more information.`, outputItem).then((item) => {
						if (item && item.id === 1) {
							client.outputChannel.show(true);
						}
					});
				}
			}
			return {};
		});

		client.onRequest(OpenESLintDocRequest.type, (params) => {
			Commands.executeCommand('vscode.open', Uri.parse(params.url));
			return {};
		});
	});

	if (dummyCommands) {
		dummyCommands.forEach(command => command.dispose());
		dummyCommands = undefined;
	}

	updateStatusBarVisibility();

	context.subscriptions.push(
		client.start(),
		Commands.registerCommand('eslint.executeAutofix', () => {
			let textEditor = Window.activeTextEditor;
			if (!textEditor) {
				return;
			}
			let textDocument: VersionedTextDocumentIdentifier = {
				uri: textEditor.document.uri.toString(),
				version: textEditor.document.version
			};
			let params: ExecuteCommandParams = {
				command: 'eslint.applyAutoFix',
				arguments: [textDocument]
			};
			client.sendRequest(ExecuteCommandRequest.type, params).then(undefined, () => {
				Window.showErrorMessage('Failed to apply ESLint fixes to the document. Please consider opening an issue with steps to reproduce.');
			});
		}),
		Commands.registerCommand('eslint.showOutputChannel', () => { client.outputChannel.show(); }),
		statusBarItem
	);
}

export function deactivate() {
	if (dummyCommands) {
		dummyCommands.forEach(command => command.dispose());
	}

	if (taskProvider) {
		taskProvider.dispose();
	}
}
