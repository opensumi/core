'use strict';

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { workspace, extensions, ExtensionContext, window, StatusBarAlignment, commands, ViewColumn, Uri, CancellationToken, TextDocumentContentProvider, TextEditor, WorkspaceConfiguration, languages, IndentAction, ProgressLocation, InputBoxOptions, Selection, Position, EventEmitter } from 'vscode';
import { ExecuteCommandParams, ExecuteCommandRequest, LanguageClient, LanguageClientOptions, RevealOutputChannelOn, Position as LSPosition, Location as LSLocation, StreamInfo, VersionedTextDocumentIdentifier } from 'vscode-languageclient';
import { onExtensionChange, collectJavaExtensions } from './plugin';
import { prepareExecutable, awaitServerConnection } from './javaServerStarter';
import * as requirements from './requirements';
import { Commands } from './commands';
import {
	StatusNotification, ClassFileContentsRequest, ProjectConfigurationUpdateRequest, MessageType, ActionableNotification, FeatureStatus, CompileWorkspaceRequest, CompileWorkspaceStatus, ProgressReportNotification, ExecuteClientCommandRequest, SendNotificationRequest,
	SourceAttachmentRequest, SourceAttachmentResult, SourceAttachmentAttribute
} from './protocol';
import { ExtensionAPI } from './extension.api';
import * as buildpath from './buildpath';
import * as sourceAction from './sourceAction';
import * as refactorAction from './refactorAction';
import * as net from 'net';
import { getJavaConfiguration } from './utils';
import { onConfigurationChange, excludeProjectSettingsFiles } from './settings';
import { logger, initializeLogFile } from './log';

let lastStatus;
let languageClient: LanguageClient;
const jdtEventEmitter = new EventEmitter<Uri>();
const cleanWorkspaceFileName = '.cleanWorkspace';
let clientLogFile;

export function activate(context: ExtensionContext): Promise<ExtensionAPI> {

	let storagePath = context.storagePath;
	if (!storagePath) {
		storagePath = getTempWorkspace();
	}
	clientLogFile = path.join(storagePath, 'client.log');
	initializeLogFile(clientLogFile);

	enableJavadocSymbols();

	return requirements.resolveRequirements().catch(error => {
		// show error
		window.showErrorMessage(error.message, error.label).then((selection) => {
			if (error.label && error.label === selection && error.command) {
				commands.executeCommand(error.command, error.commandParam);
			}
		});
		// rethrow to disrupt the chain.
		throw error;
	}).then(requirements => {
		return window.withProgress<ExtensionAPI>({ location: ProgressLocation.Window }, p => {
			return new Promise((resolve, reject) => {
				const workspacePath = path.resolve(storagePath + '/jdt_ws');

				// Options to control the language client
				const clientOptions: LanguageClientOptions = {
					// Register the server for java
					documentSelector: [
						{ scheme: 'file', language: 'java' },
						{ scheme: 'jdt', language: 'java' },
						{ scheme: 'untitled', language: 'java' }
					],
					synchronize: {
						configurationSection: 'java',
					},
					initializationOptions: {
						bundles: collectJavaExtensions(extensions.all),
						workspaceFolders: workspace.workspaceFolders ? workspace.workspaceFolders.map(f => f.uri.toString()) : null,
						settings: { java: getJavaConfiguration() },
						extendedClientCapabilities: {
							progressReportProvider: getJavaConfiguration().get('progressReports.enabled'),
							classFileContentsSupport: true,
							overrideMethodsPromptSupport: true,
							hashCodeEqualsPromptSupport: true,
							advancedOrganizeImportsSupport: true,
							generateToStringPromptSupport: true,
							advancedGenerateAccessorsSupport: true,
							generateConstructorsPromptSupport: true,
							generateDelegateMethodsPromptSupport: true,
							advancedExtractRefactoringSupport: true,
						},
						triggerFiles: getTriggerFiles()
					},
					revealOutputChannelOn: RevealOutputChannelOn.Never
				};

				const item = window.createStatusBarItem(StatusBarAlignment.Right, Number.MIN_VALUE);
				item.text = '$(sync~spin)';
				item.command = Commands.OPEN_OUTPUT;
				const progressBar = window.createStatusBarItem(StatusBarAlignment.Left, Number.MIN_VALUE + 1);

				let serverOptions;
				const port = process.env['SERVER_PORT'];
				if (!port) {
					const lsPort = process.env['JDTLS_CLIENT_PORT'];
					if (!lsPort) {
						serverOptions = prepareExecutable(requirements, workspacePath, getJavaConfiguration());
					} else {
						serverOptions = () => {
							const socket = net.connect(lsPort);
							const result: StreamInfo = {
								writer: socket,
								reader: socket
							};
							return Promise.resolve(result);
						};
					}
				} else {
					// used during development
					serverOptions = awaitServerConnection.bind(null, port);
				}

				// Create the language client and start the client.
				languageClient = new LanguageClient('java', 'Language Support for Java', serverOptions, clientOptions);
				languageClient.registerProposedFeatures();

				languageClient.onReady().then(() => {
					languageClient.onNotification(StatusNotification.type, (report) => {
						switch (report.type) {
							case 'Started':
								item.text = '$(thumbsup)';
								p.report({ message: 'Finished' });
								lastStatus = item.text;
								commands.executeCommand('setContext', 'javaLSReady', true);
								resolve({
									apiVersion: '0.2',
									javaRequirement: requirements,
									status: report.type
								});
								break;
							case 'Error':
								item.text = '$(thumbsdown)';
								lastStatus = item.text;
								p.report({ message: 'Finished with Error' });
								toggleItem(window.activeTextEditor, item);
								resolve({
									apiVersion: '0.2',
									javaRequirement: requirements,
									status: report.type
								});
								break;
							case 'Starting':
								p.report({ message: report.message });
								break;
							case 'Message':
								item.text = report.message;
								setTimeout(() => { item.text = lastStatus; }, 3000);
								break;
						}
						item.tooltip = report.message;
						toggleItem(window.activeTextEditor, item);
					});
					languageClient.onNotification(ProgressReportNotification.type, (progress) => {
						progressBar.show();
						progressBar.text = progress.status;
						if (progress.complete) {
							setTimeout(() => { progressBar.hide(); }, 500);
						}
					});
					languageClient.onNotification(ActionableNotification.type, (notification) => {
						let show = null;
						switch (notification.severity) {
							case MessageType.Log:
								show = logNotification;
								break;
							case MessageType.Info:
								show = window.showInformationMessage;
								break;
							case MessageType.Warning:
								show = window.showWarningMessage;
								break;
							case MessageType.Error:
								show = window.showErrorMessage;
								break;
						}
						if (!show) {
							return;
						}
						const titles = notification.commands.map(a => a.title);
						show(notification.message, ...titles).then((selection) => {
							for (const action of notification.commands) {
								if (action.title === selection) {
									const args: any[] = (action.arguments) ? action.arguments : [];
									commands.executeCommand(action.command, ...args);
									break;
								}
							}
						});
					});
					languageClient.onRequest(ExecuteClientCommandRequest.type, (params) => {
						return commands.executeCommand(params.command, ...params.arguments);
					});

					languageClient.onRequest(SendNotificationRequest.type, (params) => {
						return commands.executeCommand(params.command, ...params.arguments);
					});

					context.subscriptions.push(commands.registerCommand(Commands.SHOW_JAVA_REFERENCES, (uri: string, position: LSPosition, locations: LSLocation[]) => {
						commands.executeCommand(Commands.SHOW_REFERENCES, Uri.parse(uri), languageClient.protocol2CodeConverter.asPosition(position), locations.map(languageClient.protocol2CodeConverter.asLocation));
					}));
					context.subscriptions.push(commands.registerCommand(Commands.SHOW_JAVA_IMPLEMENTATIONS, (uri: string, position: LSPosition, locations: LSLocation[]) => {
						commands.executeCommand(Commands.SHOW_REFERENCES, Uri.parse(uri), languageClient.protocol2CodeConverter.asPosition(position), locations.map(languageClient.protocol2CodeConverter.asLocation));
					}));

					context.subscriptions.push(commands.registerCommand(Commands.CONFIGURATION_UPDATE, uri => projectConfigurationUpdate(languageClient, uri)));

					context.subscriptions.push(commands.registerCommand(Commands.IGNORE_INCOMPLETE_CLASSPATH, (data?: any) => setIncompleteClasspathSeverity('ignore')));

					context.subscriptions.push(commands.registerCommand(Commands.IGNORE_INCOMPLETE_CLASSPATH_HELP, (data?: any) => {
						commands.executeCommand(Commands.OPEN_BROWSER, Uri.parse('https://github.com/redhat-developer/vscode-java/wiki/%22Classpath-is-incomplete%22-warning'));
					}));

					context.subscriptions.push(commands.registerCommand(Commands.PROJECT_CONFIGURATION_STATUS, (uri, status) => setProjectConfigurationUpdate(languageClient, uri, status)));

					context.subscriptions.push(commands.registerCommand(Commands.APPLY_WORKSPACE_EDIT, (obj) => {
						applyWorkspaceEdit(obj, languageClient);
					}));

					context.subscriptions.push(commands.registerCommand(Commands.EXECUTE_WORKSPACE_COMMAND, (command, ...rest) => {
						const params: ExecuteCommandParams = {
							command,
							arguments: rest
						};
						return languageClient.sendRequest(ExecuteCommandRequest.type, params);
					}));

					context.subscriptions.push(commands.registerCommand(Commands.COMPILE_WORKSPACE, (isFullCompile: boolean) => {
						return window.withProgress({ location: ProgressLocation.Window }, async p => {
							if (typeof isFullCompile !== 'boolean') {
								const selection = await window.showQuickPick(['Incremental', 'Full'], { placeHolder: 'please choose compile type:' });
								isFullCompile = selection !== 'Incremental';
							}
							p.report({ message: 'Compiling workspace...' });
							const start = new Date().getTime();
							const res = await languageClient.sendRequest(CompileWorkspaceRequest.type, isFullCompile);
							const elapsed = new Date().getTime() - start;
							const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
							return new Promise((resolve, reject) => {
								setTimeout(() => { // set a timeout so user would still see the message when build time is short
									if (res === CompileWorkspaceStatus.SUCCEED) {
										resolve(res);
									} else {
										reject(res);
									}
								}, humanVisibleDelay);
							});
						});
					}));

					context.subscriptions.push(commands.registerCommand(Commands.UPDATE_SOURCE_ATTACHMENT, async (classFileUri: Uri): Promise<boolean> => {
						const resolveRequest: SourceAttachmentRequest = {
							classFileUri: classFileUri.toString(),
						};
						const resolveResult: SourceAttachmentResult = await <SourceAttachmentResult>commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.RESOLVE_SOURCE_ATTACHMENT, JSON.stringify(resolveRequest));
						if (resolveResult.errorMessage) {
							window.showErrorMessage(resolveResult.errorMessage);
							return false;
						}

						const attributes: SourceAttachmentAttribute = resolveResult.attributes || {};
						const defaultPath = attributes.sourceAttachmentPath || attributes.jarPath;
						const sourceFileUris: Uri[] = await window.showOpenDialog({
							defaultUri: defaultPath ? Uri.file(defaultPath) : null,
							openLabel: 'Select Source File',
							canSelectFiles: true,
							canSelectFolders: false,
							canSelectMany: false,
							filters: {
								'Source files': ['jar', 'zip']
							},
						});

						if (sourceFileUris && sourceFileUris.length) {
							const updateRequest: SourceAttachmentRequest = {
								classFileUri: classFileUri.toString(),
								attributes: {
									...attributes,
									sourceAttachmentPath: sourceFileUris[0].fsPath
								},
							};
							const updateResult: SourceAttachmentResult = await <SourceAttachmentResult>commands.executeCommand(Commands.EXECUTE_WORKSPACE_COMMAND, Commands.UPDATE_SOURCE_ATTACHMENT, JSON.stringify(updateRequest));
							if (updateResult.errorMessage) {
								window.showErrorMessage(updateResult.errorMessage);
								return false;
							}

							// Notify jdt content provider to rerender the classfile contents.
							jdtEventEmitter.fire(classFileUri);
							return true;
						}
					}));

					buildpath.registerCommands(context);
					sourceAction.registerCommands(languageClient, context);
					refactorAction.registerCommands(languageClient, context);

					context.subscriptions.push(window.onDidChangeActiveTextEditor((editor) => {
						toggleItem(editor, item);
					}));

					const provider: TextDocumentContentProvider = <TextDocumentContentProvider>{
						onDidChange: jdtEventEmitter.event,
						provideTextDocumentContent: (uri: Uri, token: CancellationToken): Thenable<string> => {
							return languageClient.sendRequest(ClassFileContentsRequest.type, { uri: uri.toString() }, token).then((v: string): string => {
								return v || '';
							});
						}
					};
					context.subscriptions.push(workspace.registerTextDocumentContentProvider('jdt', provider));
					if (extensions.onDidChange) {// Theia doesn't support this API yet
						extensions.onDidChange(() => {
							onExtensionChange(extensions.all);
						});
					}
					excludeProjectSettingsFiles();
				});

				const cleanWorkspaceExists = fs.existsSync(path.join(workspacePath, cleanWorkspaceFileName));
				if (cleanWorkspaceExists) {
					try {
						deleteDirectory(workspacePath);
					} catch (error) {
						window.showErrorMessage(`Failed to delete ${workspacePath}: ${error}`);
					}
				}

				languageClient.start();
				// Register commands here to make it available even when the language client fails

				context.subscriptions.push(commands.registerCommand(Commands.OPEN_OUTPUT, () =>  languageClient.outputChannel.show(ViewColumn.Three)));

				context.subscriptions.push(commands.registerCommand(Commands.OPEN_SERVER_LOG, () => openServerLogFile(workspacePath)));

				context.subscriptions.push(commands.registerCommand(Commands.OPEN_CLIENT_LOG, () => openClientLogFile(clientLogFile)));

				const extensionPath = context.extensionPath;
				context.subscriptions.push(commands.registerCommand(Commands.OPEN_FORMATTER, async () => openFormatter(extensionPath)));

				context.subscriptions.push(commands.registerCommand(Commands.CLEAN_WORKSPACE, () => cleanWorkspace(workspacePath)));

				context.subscriptions.push(onConfigurationChange());
				toggleItem(window.activeTextEditor, item);
			});
		});
	});
}

export function deactivate(): Thenable<void> {
	if (!languageClient) {
		return undefined;
	}
	return languageClient.stop();
}

function enableJavadocSymbols() {
	// Let's enable Javadoc symbols autocompletion, shamelessly copied from MIT licensed code at
	// https://github.com/Microsoft/vscode/blob/9d611d4dfd5a4a101b5201b8c9e21af97f06e7a7/extensions/typescript/src/typescriptMain.ts#L186
	languages.setLanguageConfiguration('java', {
		indentationRules: {
			// ^(.*\*/)?\s*\}.*$
			decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
			// ^.*\{[^}"']*$
			increaseIndentPattern: /^.*\{[^}"']*$/
		},
		wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
		onEnterRules: [
			{
				// e.g. /** | */
				beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
				afterText: /^\s*\*\/$/,
				action: { indentAction: IndentAction.IndentOutdent, appendText: ' * ' }
			},
			{
				// e.g. /** ...|
				beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
				action: { indentAction: IndentAction.None, appendText: ' * ' }
			},
			{
				// e.g.  * ...|
				beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
				action: { indentAction: IndentAction.None, appendText: '* ' }
			},
			{
				// e.g.  */|
				beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
				action: { indentAction: IndentAction.None, removeText: 1 }
			},
			{
				// e.g.  *-----*/|
				beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
				action: { indentAction: IndentAction.None, removeText: 1 }
			}
		]
	});
}

function logNotification(message: string, ...items: string[]) {
	return new Promise((resolve, reject) => {
		logger.verbose(message);
	});
}

function setIncompleteClasspathSeverity(severity: string) {
	const config = getJavaConfiguration();
	const section = 'errors.incompleteClasspath.severity';
	config.update(section, severity, true).then(
		() => logger.info(`${section} globally set to ${severity}`),
		(error) => logger.error(error)
	);
}

function projectConfigurationUpdate(languageClient: LanguageClient, uri?: Uri) {
	let resource = uri;
	if (!(resource instanceof Uri)) {
		if (window.activeTextEditor) {
			resource = window.activeTextEditor.document.uri;
		}
	}
	if (!resource) {
		return window.showWarningMessage('No Java project to update!').then(() => false);
	}
	if (isJavaConfigFile(resource.path)) {
		languageClient.sendNotification(ProjectConfigurationUpdateRequest.type, {
			uri: resource.toString()
		});
	}
}

function setProjectConfigurationUpdate(languageClient: LanguageClient, uri: Uri, status: FeatureStatus) {
	const config = getJavaConfiguration();
	const section = 'configuration.updateBuildConfiguration';

	const st = FeatureStatus[status];
	config.update(section, st).then(
		() => logger.info(`${section} set to ${st}`),
		(error) => logger.error(error)
	);
	if (status !== FeatureStatus.disabled) {
		projectConfigurationUpdate(languageClient, uri);
	}
}
function toggleItem(editor: TextEditor, item) {
	if (editor && editor.document &&
		(editor.document.languageId === 'java' || isJavaConfigFile(editor.document.uri.path))) {
		item.show();
	} else {
		item.hide();
	}
}

function isJavaConfigFile(path: String) {
	return path.endsWith('pom.xml') || path.endsWith('.gradle');
}

function getTempWorkspace() {
	return path.resolve(os.tmpdir(), 'vscodesws_' + makeRandomHexString(5));
}

function makeRandomHexString(length) {
	const chars = ['0', '1', '2', '3', '4', '5', '6', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];
	let result = '';
	for (let i = 0; i < length; i++) {
		const idx = Math.floor(chars.length * Math.random());
		result += chars[idx];
	}
	return result;
}

async function cleanWorkspace(workspacePath) {
	const doIt = 'Restart and delete';
	window.showWarningMessage('Are you sure you want to clean the Java language server workspace?', 'Cancel', doIt).then(selection => {
		if (selection === doIt) {
			const file = path.join(workspacePath, cleanWorkspaceFileName);
			fs.closeSync(fs.openSync(file, 'w'));
			commands.executeCommand(Commands.RELOAD_WINDOW);
		}
	});
}

function deleteDirectory(dir) {
	if (fs.existsSync(dir)) {
		fs.readdirSync(dir).forEach((child) => {
			const entry = path.join(dir, child);
			if (fs.lstatSync(entry).isDirectory()) {
				deleteDirectory(entry);
			} else {
				fs.unlinkSync(entry);
			}
		});
		fs.rmdirSync(dir);
	}
}

function openServerLogFile(workspacePath): Thenable<boolean> {
	const serverLogFile = path.join(workspacePath, '.metadata', '.log');
	return openLogFile(serverLogFile, 'Could not open Java Language Server log file');
}

function openClientLogFile(logFile): Thenable<boolean> {
	return openLogFile(logFile, 'Could not open Java extension log file');
}


function openLogFile(logFile, openingFailureWarning:string ): Thenable<boolean> {
	if (!fs.existsSync(logFile)) {
		return window.showWarningMessage('No log file available').then(() => false);
	}

	return workspace.openTextDocument(logFile)
		.then(doc => {
			if (!doc) {
				return false;
			}
			return window.showTextDocument(doc, window.activeTextEditor ?
				window.activeTextEditor.viewColumn : undefined)
				.then(editor => !!editor);
		}, () => false)
		.then(didOpen => {
			if (!didOpen) {
				window.showWarningMessage(openingFailureWarning);
			}
			return didOpen;
		});
}

async function openFormatter(extensionPath) {
	const defaultFormatter = path.join(extensionPath, 'formatters', 'eclipse-formatter.xml');
	const formatterUrl: string = getJavaConfiguration().get('format.settings.url');
	if (formatterUrl && formatterUrl.length > 0) {
		if (isRemote(formatterUrl)) {
			commands.executeCommand(Commands.OPEN_BROWSER, Uri.parse(formatterUrl));
		} else {
			const document = getPath(formatterUrl);
			if (document && fs.existsSync(document)) {
				return openDocument(extensionPath, document, defaultFormatter, null);
			}
		}
	}
	const global = workspace.workspaceFolders === undefined;
	const fileName = formatterUrl || 'eclipse-formatter.xml';
	let file;
	let relativePath;
	if (!global) {
		file = path.join(workspace.workspaceFolders[0].uri.fsPath, fileName);
		relativePath = fileName;
	} else {
		const root = path.join(extensionPath, '..', 'redhat.java');
		if (!fs.existsSync(root)) {
			fs.mkdirSync(root);
		}
		file = path.join(root, fileName);
	}
	if (!fs.existsSync(file)) {
		addFormatter(extensionPath, file, defaultFormatter, relativePath);
	} else {
		if (formatterUrl) {
			getJavaConfiguration().update('format.settings.url', (relativePath !== null ? relativePath : file), global);
			openDocument(extensionPath, file, file, defaultFormatter);
		} else {
			addFormatter(extensionPath, file, defaultFormatter, relativePath);
		}
	}
}

function getPath(f) {
	if (workspace.workspaceFolders && !path.isAbsolute(f)) {
		workspace.workspaceFolders.forEach(wf => {
			const file = path.resolve(wf.uri.path, f);
			if (fs.existsSync(file)) {
				return file;
			}
		});
	} else {
		return path.resolve(f);
	}
	return null;
}

function openDocument(extensionPath, formatterUrl, defaultFormatter, relativePath) {
	return workspace.openTextDocument(formatterUrl)
		.then(doc => {
			if (!doc) {
				addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath);
			}
			return window.showTextDocument(doc, window.activeTextEditor ?
				window.activeTextEditor.viewColumn : undefined)
				.then(editor => !!editor);
		}, () => false)
		.then(didOpen => {
			if (!didOpen) {
				window.showWarningMessage('Could not open Formatter Settings file');
				addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath);
			} else {
				return didOpen;
			}
		});
}

function isRemote(f) {
	return f !== null && f.startsWith('http:/') || f.startsWith('https:/');
}

async function addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath) {
	const options: InputBoxOptions = {
		value: (relativePath ? relativePath : formatterUrl),
		prompt: 'please enter URL or Path:',
		ignoreFocusOut: true
	};
	await window.showInputBox(options).then(f => {
		if (f) {
			const global = workspace.workspaceFolders === undefined;
			if (isRemote(f)) {
				commands.executeCommand(Commands.OPEN_BROWSER, Uri.parse(f));
				getJavaConfiguration().update('format.settings.url', f, global);
			} else {
				if (!path.isAbsolute(f)) {
					const fileName = f;
					if (!global) {
						f = path.join(workspace.workspaceFolders[0].uri.fsPath, fileName);
						relativePath = fileName;
					} else {
						const root = path.join(extensionPath, '..', 'redhat.java');
						if (!fs.existsSync(root)) {
							fs.mkdirSync(root);
						}
						f = path.join(root, fileName);
					}
				} else {
					relativePath = null;
				}
				getJavaConfiguration().update('format.settings.url', (relativePath !== null ? relativePath : f), global);
				if (!fs.existsSync(f)) {
					const name = relativePath !== null ? relativePath : f;
					const msg = `' ${name} ' does not exist. Do you want to create it?`;
					const action = 'Yes';
					window.showWarningMessage(msg, action, 'No').then((selection) => {
						if (action === selection) {
							fs.createReadStream(defaultFormatter)
								.pipe(fs.createWriteStream(f))
								.on('finish', () => openDocument(extensionPath, f, defaultFormatter, relativePath));
						}
					});
				} else {
					openDocument(extensionPath, f, defaultFormatter, relativePath);
				}
			}
		}
	});
}

export async function applyWorkspaceEdit(obj, languageClient) {
	const edit = languageClient.protocol2CodeConverter.asWorkspaceEdit(obj);
	if (edit) {
		await workspace.applyEdit(edit);
		// By executing the range formatting command to correct the indention according to the VS Code editor settings.
		// More details, see: https://github.com/redhat-developer/vscode-java/issues/557
		try {
			const currentEditor = window.activeTextEditor;
			// If the Uri path of the edit change is not equal to that of the active editor, we will skip the range formatting
			if (currentEditor.document.uri.fsPath !== edit.entries()[0][0].fsPath) {
				return;
			}
			const cursorPostion = currentEditor.selection.active;
			// Get the array of all the changes
			const changes = edit.entries()[0][1];
			// Get the position information of the first change
			let startPosition = new Position(changes[0].range.start.line, changes[0].range.start.character);
			let lineOffsets = changes[0].newText.split(/\r?\n/).length - 1;
			for (let i = 1; i < changes.length; i++) {
				// When it comes to a discontinuous range, execute the range formatting and record the new start position
				if (changes[i].range.start.line !== startPosition.line) {
					await executeRangeFormat(currentEditor, startPosition, lineOffsets);
					startPosition = new Position(changes[i].range.start.line, changes[i].range.start.character);
					lineOffsets = 0;
				}
				lineOffsets += changes[i].newText.split(/\r?\n/).length - 1;
			}
			await executeRangeFormat(currentEditor, startPosition, lineOffsets);
			// Recover the cursor's original position
			currentEditor.selection = new Selection(cursorPostion, cursorPostion);
		} catch (error) {
			languageClient.error(error);
		}
	}
}

async function executeRangeFormat(editor, startPosition, lineOffset) {
	const endPosition = editor.document.positionAt(editor.document.offsetAt(new Position(startPosition.line + lineOffset + 1, 0)) - 1);
	editor.selection = new Selection(startPosition, endPosition);
	await commands.executeCommand('editor.action.formatSelection');
}

function getTriggerFiles(): string[] {
	const openedJavaFiles = [];
	const activeJavaFile = getJavaFilePathOfTextEditor(window.activeTextEditor);
	if (activeJavaFile) {
		openedJavaFiles.push(Uri.file(activeJavaFile).toString());
	}

	if (!workspace.workspaceFolders) {
		return openedJavaFiles;
	}

	for (const rootFolder of workspace.workspaceFolders) {
		if (rootFolder.uri.scheme !== 'file') {
			continue;
		}

		const rootPath = path.normalize(rootFolder.uri.fsPath);
		if (isPrefix(rootPath, activeJavaFile)) {
			continue;
		}

		for (const textEditor of window.visibleTextEditors) {
			const javaFileInTextEditor = getJavaFilePathOfTextEditor(textEditor);
			if (isPrefix(rootPath, javaFileInTextEditor)) {
				openedJavaFiles.push(Uri.file(javaFileInTextEditor).toString());
				break;
			}
		}
	}

	return openedJavaFiles;
}

function getJavaFilePathOfTextEditor(editor: TextEditor): string | undefined {
	if (editor) {
		const resource = editor.document.uri;
		if (resource.scheme === 'file' && resource.fsPath.endsWith('.java')) {
			return path.normalize(resource.fsPath);
		}
	}

	return undefined;
}

function isPrefix(parentPath: string, childPath: string): boolean {
	if (!childPath) {
		return false;
	}
	const relative = path.relative(parentPath, childPath);
	return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
