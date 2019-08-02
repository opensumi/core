/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	createConnection, IConnection,
	ResponseError, RequestType, NotificationType, ErrorCodes,
	RequestHandler, NotificationHandler,
	Diagnostic, DiagnosticSeverity, Range, Files, CancellationToken,
	TextDocuments, TextDocument, TextDocumentSyncKind, TextEdit, TextDocumentIdentifier, TextDocumentSaveReason,
	Command, WorkspaceChange,
	CodeActionRequest, VersionedTextDocumentIdentifier,
	ExecuteCommandRequest, DidChangeWatchedFilesNotification, DidChangeConfigurationNotification,
	WorkspaceFolder, DidChangeWorkspaceFoldersNotification, CodeAction, CodeActionKind, Position
} from 'vscode-languageserver';

import URI from 'vscode-uri';
import * as path from 'path';
import { execSync } from 'child_process';
import { EOL } from 'os';
import { isFunction } from 'util';

namespace Is {
	const toString = Object.prototype.toString;

	export function boolean(value: any): value is boolean {
		return value === true || value === false;
	}

	export function string(value: any): value is string {
		return toString.call(value) === '[object String]';
	}
}

namespace CommandIds {
	export const applySingleFix: string = 'eslint.applySingleFix';
	export const applySameFixes: string = 'eslint.applySameFixes';
	export const applyAllFixes: string = 'eslint.applyAllFixes';
	export const applyAutoFix: string = 'eslint.applyAutoFix';
	export const applyDisableLine: string = 'eslint.applyDisableLine';
	export const applyDisableFile: string = 'eslint.applyDisableFile';
	export const openRuleDoc: string = 'eslint.openRuleDoc';
}

interface ESLintError extends Error {
	messageTemplate?: string;
	messageData?: {
		pluginName?: string;
	};
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

type RunValues = 'onType' | 'onSave';

interface DirectoryItem {
	directory: string;
	changeProcessCWD?: boolean;
}

namespace DirectoryItem {
	export function is(item: any): item is DirectoryItem {
		let candidate = item as DirectoryItem;
		return candidate && Is.string(candidate.directory) && (Is.boolean(candidate.changeProcessCWD) || candidate.changeProcessCWD === undefined);
	}
}

interface CodeActionSettings {
	disableRuleComment: {
		enable: boolean;
		location: 'separateLine' | 'sameLine';
	};
	showDocumentation: {
		enable: boolean;
	};
}

type PackageManagers = 'npm' | 'yarn' | 'pnpm';

type ESLintOptions = object & { fixTypes?: string[] };
interface TextDocumentSettings {
	validate: boolean;
	packageManager: PackageManagers;
	autoFix: boolean;
	autoFixOnSave: boolean;
	quiet: boolean;
	options: ESLintOptions | undefined;
	run: RunValues;
	nodePath: string | undefined;
	workspaceFolder: WorkspaceFolder | undefined;
	workingDirectory: DirectoryItem | undefined;
	library: ESLintModule | undefined;
	resolvedGlobalPackageManagerPath: string | undefined;
	codeAction: CodeActionSettings;
}

interface ESLintAutoFixEdit {
	range: [number, number];
	text: string;
}

interface ESLintProblem {
	line: number;
	column: number;
	endLine?: number;
	endColumn?: number;
	severity: number;
	ruleId: string;
	message: string;
	fix?: ESLintAutoFixEdit;
}

interface ESLintDocumentReport {
	filePath: string;
	errorCount: number;
	warningCount: number;
	messages: ESLintProblem[];
	output?: string;
}

interface ESLintReport {
	errorCount: number;
	warningCount: number;
	results: ESLintDocumentReport[];
}

interface CLIOptions {
	cwd?: string;
	fixTypes?: string[];
}

// { meta: { docs: [Object], schema: [Array] }, create: [Function: create] }
interface RuleData {
	meta?: {
		docs?: {
			url?: string;
		};
		type?: string;
	};
}

interface CLIEngine {
	executeOnText(content: string, file?:string): ESLintReport;
	// This is only available from v4.15.0 forward
	getRules?(): Map<string, RuleData>;
}

interface CLIEngineConstructor {
	new (options: CLIOptions): CLIEngine;
}


interface ESLintModule {
	CLIEngine: CLIEngineConstructor;
}

declare const __webpack_require__: typeof require;
declare const __non_webpack_require__: typeof require;
function loadNodeModule<T>(moduleName: string): T | undefined {
	const r =  typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require;
	try {
		return r(moduleName);
	} catch (err) {
		// Not available.
	}
	return undefined;
}

function makeDiagnostic(problem: ESLintProblem): Diagnostic {
	let message = problem.message;
	let startLine = Math.max(0, problem.line - 1);
	let startChar = Math.max(0, problem.column - 1);
	let endLine = problem.endLine != null ? Math.max(0, problem.endLine - 1) : startLine;
	let endChar = problem.endColumn != null ? Math.max(0, problem.endColumn - 1) : startChar;
	return {
		message: message,
		severity: convertSeverity(problem.severity),
		source: 'eslint',
		range: {
			start: { line: startLine, character: startChar },
			end: { line: endLine, character: endChar }
		},
		code: problem.ruleId
	};
}

interface FixableProblem {
	label: string;
	documentVersion: number;
	ruleId: string;
	line: number;
	edit?: ESLintAutoFixEdit;
}

function computeKey(diagnostic: Diagnostic): string {
	let range = diagnostic.range;
	return `[${range.start.line},${range.start.character},${range.end.line},${range.end.character}]-${diagnostic.code}`;
}

let codeActions: Map<string, Map<string, FixableProblem>> = new Map<string, Map<string, FixableProblem>>();
function recordCodeAction(document: TextDocument, diagnostic: Diagnostic, problem: ESLintProblem): void {
	if (!problem.ruleId) {
		return;
	}
	let uri = document.uri;
	let edits: Map<string, FixableProblem> = codeActions.get(uri);
	if (!edits) {
		edits = new Map<string, FixableProblem>();
		codeActions.set(uri, edits);
	}
	edits.set(computeKey(diagnostic), { label: `Fix this ${problem.ruleId} problem`, documentVersion: document.version, ruleId: problem.ruleId, edit: problem.fix, line: problem.line });
}

function convertSeverity(severity: number): DiagnosticSeverity {
	switch (severity) {
		// Eslint 1 is warning
		case 1:
			return DiagnosticSeverity.Warning;
		case 2:
			return DiagnosticSeverity.Error;
		default:
			return DiagnosticSeverity.Error;
	}
}

const enum CharCode {
	/**
	 * The `\` character.
	 */
	Backslash = 92,
}

/**
 * Check if the path follows this pattern: `\\hostname\sharename`.
 *
 * @see https://msdn.microsoft.com/en-us/library/gg465305.aspx
 * @return A boolean indication if the path is a UNC path, on none-windows
 * always false.
 */
function isUNC(path: string): boolean {
	if (process.platform !== 'win32') {
		// UNC is a windows concept
		return false;
	}

	if (!path || path.length < 5) {
		// at least \\a\b
		return false;
	}

	let code = path.charCodeAt(0);
	if (code !== CharCode.Backslash) {
		return false;
	}
	code = path.charCodeAt(1);
	if (code !== CharCode.Backslash) {
		return false;
	}
	let pos = 2;
	let start = pos;
	for (; pos < path.length; pos++) {
		code = path.charCodeAt(pos);
		if (code === CharCode.Backslash) {
			break;
		}
	}
	if (start === pos) {
		return false;
	}
	code = path.charCodeAt(pos + 1);
	if (isNaN(code) || code === CharCode.Backslash) {
		return false;
	}
	return true;
}

function getFileSystemPath(uri: URI): string {
	let result = uri.fsPath;
	if (process.platform === 'win32' && result.length >= 2 && result[1] === ':') {
		// Node by default uses an upper case drive letter and ESLint uses
		// === to compare paths which results in the equal check failing
		// if the drive letter is lower case in th URI. Ensure upper case.
		return result[0].toUpperCase() + result.substr(1);
	} else {
		return result;
	}
}


function getFilePath(documentOrUri: string | TextDocument): string {
	if (!documentOrUri) {
		return undefined;
	}
	let uri = Is.string(documentOrUri) ? URI.parse(documentOrUri) : URI.parse(documentOrUri.uri);
	if (uri.scheme !== 'file') {
		return undefined;
	}
	return getFileSystemPath(uri);
}

const exitCalled = new NotificationType<[number, string], void>('eslint/exitCalled');

const nodeExit = process.exit;
process.exit = ((code?: number): void => {
	let stack = new Error('stack');
	connection.sendNotification(exitCalled, [code ? code : 0, stack.stack]);
	setTimeout(() => {
		nodeExit(code);
	}, 1000);
}) as any;
process.on('uncaughtException', (error: any) => {
	let message: string;
	if (error) {
		if (typeof error.stack === 'string') {
			message = error.stack;
		} else if (typeof error.message === 'string') {
			message = error.message;
		} else if (typeof error === 'string') {
			message = error;
		}
		if (!message) {
			try {
				message = JSON.stringify(error, undefined, 4);
			} catch (e) {
				// Should not happen.
			}
		}
	}
	console.error('Uncaught exception received.');
	if (message) {
		console.error(message);
	}
});

let connection = createConnection();
connection.console.info(`ESLint server running in node ${process.version}`);
let documents: TextDocuments = new TextDocuments(TextDocumentSyncKind.Incremental);

const _globalPaths: { [key: string]: { cache: string; get(): string; } } = {
	yarn: {
		cache: undefined,
		get(): string {
			return Files.resolveGlobalYarnPath(trace);
		}
	},
	npm: {
		cache: undefined,
		get(): string {
			return Files.resolveGlobalNodePath(trace);
		}
	},
	pnpm: {
		cache: undefined,
		get(): string {
			const pnpmPath = execSync('pnpm root -g').toString().trim();
			return pnpmPath;
		}
	}
};

function globalPathGet(packageManager: PackageManagers): string {
	const pm = _globalPaths[packageManager];
	if (pm) {
		if (pm.cache === undefined) {
			pm.cache = pm.get();
		}
		return pm.cache;
	}
	return undefined;
}
let path2Library: Map<string, ESLintModule> = new Map<string, ESLintModule>();
let document2Settings: Map<string, Thenable<TextDocumentSettings>> = new Map<string, Thenable<TextDocumentSettings>>();

function resolveSettings(document: TextDocument): Thenable<TextDocumentSettings> {
	let uri = document.uri;
	let resultPromise = document2Settings.get(uri);
	if (resultPromise) {
		return resultPromise;
	}
	resultPromise = connection.workspace.getConfiguration({ scopeUri: uri, section: '' }).then((settings: TextDocumentSettings) => {
		settings.resolvedGlobalPackageManagerPath = globalPathGet(settings.packageManager);
		let uri = URI.parse(document.uri);
		let promise: Thenable<string>;
		if (uri.scheme === 'file') {
			let file = uri.fsPath;
			let directory = path.dirname(file);
			if (settings.nodePath) {
				let nodePath = settings.nodePath;
				if (!path.isAbsolute(nodePath) && settings.workspaceFolder !== undefined) {
					let uri = URI.parse(settings.workspaceFolder.uri);
					if (uri.scheme === 'file') {
						nodePath = path.join(uri.fsPath, nodePath);
					}
				}
				promise = Files.resolve('eslint', nodePath, nodePath, trace).then<string, string>(undefined, () => {
					return Files.resolve('eslint', settings.resolvedGlobalPackageManagerPath, directory, trace);
				});
			} else {
				promise = Files.resolve('eslint', settings.resolvedGlobalPackageManagerPath, directory, trace);
			}
		} else {
			promise = Files.resolve('eslint', settings.resolvedGlobalPackageManagerPath, settings.workspaceFolder ? settings.workspaceFolder.uri : undefined, trace);
		}
		return promise.then((path) => {
			let library = path2Library.get(path);
			if (!library) {
				library = loadNodeModule(path);
				if (!library.CLIEngine) {
					settings.validate = false;
					connection.console.error(`The eslint library loaded from ${path} doesn\'t export a CLIEngine. You need at least eslint@1.0.0`);
				} else {
					connection.console.info(`ESLint library loaded from: ${path}`);
					settings.library = library;
				}
				path2Library.set(path, library);
			} else {
				settings.library = library;
			}
			return settings;
		}, () => {
			settings.validate = false;
			connection.sendRequest(NoESLintLibraryRequest.type, { source: { uri: document.uri } });
			return settings;
		});
	});
	document2Settings.set(uri, resultPromise);
	return resultPromise;
}

interface Request<P, R> {
	method: string;
	params: P;
	documentVersion: number | undefined;
	resolve: (value: R | Thenable<R>) => void | undefined;
	reject: (error: any) => void | undefined;
	token: CancellationToken | undefined;
}

namespace Request {
	export function is(value: any): value is Request<any, any> {
		let candidate: Request<any, any> = value;
		return candidate && !!candidate.token && !!candidate.resolve && !!candidate.reject;
	}
}

interface Notification<P> {
	method: string;
	params: P;
	documentVersion: number;
}

type Message<P, R> = Notification<P> | Request<P, R>;

interface VersionProvider<P> {
	(params: P): number;
}

namespace Thenable {
	export function is<T>(value: any): value is Thenable<T> {
		let candidate: Thenable<T> = value;
		return candidate && typeof candidate.then === 'function';
	}
}

class BufferedMessageQueue {

	private queue: Message<any, any>[];
	private requestHandlers: Map<string, {handler: RequestHandler<any, any, any>, versionProvider?: VersionProvider<any>}>;
	private notificationHandlers: Map<string, {handler: NotificationHandler<any>, versionProvider?: VersionProvider<any>}>;
	private timer: NodeJS.Immediate | undefined;

	constructor(private connection: IConnection) {
		this.queue = [];
		this.requestHandlers = new Map();
		this.notificationHandlers = new Map();
	}

	public registerRequest<P, R, E, RO>(type: RequestType<P, R, E, RO>, handler: RequestHandler<P, R, E>, versionProvider?: VersionProvider<P>): void {
		this.connection.onRequest(type, (params, token) => {
			return new Promise<R>((resolve, reject) => {
				this.queue.push({
					method: type.method,
					params: params,
					documentVersion: versionProvider ? versionProvider(params) : undefined,
					resolve: resolve,
					reject: reject,
					token: token
				});
				this.trigger();
			});
		});
		this.requestHandlers.set(type.method, { handler, versionProvider });
	}

	public registerNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>, versionProvider?: (params: P) => number): void {
		connection.onNotification(type, (params) => {
			this.queue.push({
				method: type.method,
				params: params,
				documentVersion: versionProvider ? versionProvider(params) : undefined,
			});
			this.trigger();
		});
		this.notificationHandlers.set(type.method, { handler, versionProvider });
	}

	public addNotificationMessage<P, RO>(type: NotificationType<P, RO>, params: P, version: number) {
		this.queue.push({
			method: type.method,
			params,
			documentVersion: version
		});
		this.trigger();
	}

	public onNotification<P, RO>(type: NotificationType<P, RO>, handler: NotificationHandler<P>, versionProvider?: (params: P) => number): void {
		this.notificationHandlers.set(type.method, { handler, versionProvider });
	}

	private trigger(): void {
		if (this.timer || this.queue.length === 0) {
			return;
		}
		this.timer = setImmediate(() => {
			this.timer = undefined;
			this.processQueue();
		});
	}

	private processQueue(): void {
		let message = this.queue.shift();
		if (!message) {
			return;
		}
		if (Request.is(message)) {
			let requestMessage = message;
			if (requestMessage.token.isCancellationRequested) {
				requestMessage.reject(new ResponseError(ErrorCodes.RequestCancelled, 'Request got cancelled'));
				return;
			}
			let elem = this.requestHandlers.get(requestMessage.method);
			if (elem.versionProvider && requestMessage.documentVersion !== undefined && requestMessage.documentVersion !== elem.versionProvider(requestMessage.params)) {
				requestMessage.reject(new ResponseError(ErrorCodes.RequestCancelled, 'Request got cancelled'));
				return;
			}
			let result = elem.handler(requestMessage.params, requestMessage.token);
			if (Thenable.is(result)) {
				result.then((value) => {
					requestMessage.resolve(value);
				}, (error) => {
					requestMessage.reject(error);
				});
			} else {
				requestMessage.resolve(result);
			}
		} else {
			let notificationMessage = message;
			let elem = this.notificationHandlers.get(notificationMessage.method);
			if (elem.versionProvider && notificationMessage.documentVersion !== undefined && notificationMessage.documentVersion !== elem.versionProvider(notificationMessage.params)) {
				return;
			}
			elem.handler(notificationMessage.params);
		}
		this.trigger();
	}
}

let messageQueue: BufferedMessageQueue = new BufferedMessageQueue(connection);

namespace ValidateNotification {
	export const type: NotificationType<TextDocument, void> = new NotificationType<TextDocument, void>('eslint/validate');
}

messageQueue.onNotification(ValidateNotification.type, (document) => {
	validateSingle(document, true);
}, (document): number => {
	return document.version;
});

// The documents manager listen for text document create, change
// and close on the connection
documents.listen(connection);
documents.onDidOpen((event) => {
	resolveSettings(event.document).then((settings) => {
		if (!settings.validate) {
			return;
		}
		if (settings.run === 'onSave') {
			messageQueue.addNotificationMessage(ValidateNotification.type, event.document, event.document.version);
		}
	});
});

// A text document has changed. Validate the document according the run setting.
documents.onDidChangeContent((event) => {
	resolveSettings(event.document).then((settings) => {
		if (!settings.validate || settings.run !== 'onType') {
			return;
		}
		messageQueue.addNotificationMessage(ValidateNotification.type, event.document, event.document.version);
	});
});

function getFixes(textDocument: TextDocument): TextEdit[] {
	let uri = textDocument.uri;
	let edits = codeActions.get(uri);
	function createTextEdit(editInfo: FixableProblem): TextEdit {
		return TextEdit.replace(Range.create(textDocument.positionAt(editInfo.edit.range[0]), textDocument.positionAt(editInfo.edit.range[1])), editInfo.edit.text || '');
	}
	if (edits) {
		let fixes = new Fixes(edits);
		if (fixes.isEmpty() || textDocument.version !== fixes.getDocumentVersion()) {
			return [];
		}
		return fixes.getOverlapFree().filter(fix => !!fix.edit).map(createTextEdit);
	}
	return [];
}

documents.onWillSaveWaitUntil((event) => {
	if (event.reason === TextDocumentSaveReason.AfterDelay) {
		return [];
	}

	let document = event.document;
	return resolveSettings(document).then((settings) => {
		if (!settings.autoFixOnSave) {
			return [];
		}
		// If we validate on save and want to apply fixes on will save
		// we need to validate the file.
		if (settings.run === 'onSave') {
			// Do not queue this since we want to get the fixes as fast as possible.
			return validateSingle(document, false).then(() => getFixes(document));
		} else {
			return getFixes(document);
		}
	});
});

// A text document has been saved. Validate the document according the run setting.
documents.onDidSave((event) => {
	resolveSettings(event.document).then((settings) => {
		if (!settings.validate || settings.run !== 'onSave') {
			return;
		}
		messageQueue.addNotificationMessage(ValidateNotification.type, event.document, event.document.version);
	});
});

documents.onDidClose((event) => {
	resolveSettings(event.document).then((settings) => {
		let uri = event.document.uri;
		document2Settings.delete(uri);
		codeActions.delete(uri);
		if (settings.validate) {
			connection.sendDiagnostics({ uri: uri, diagnostics: [] });
		}
	});
});

function environmentChanged() {
	document2Settings.clear();
	for (let document of documents.all()) {
		messageQueue.addNotificationMessage(ValidateNotification.type, document, document.version);
	}
}

function trace(message: string, verbose?: string): void {
	connection.tracer.log(message, verbose);
}

connection.onInitialize((_params) => {
	return {
		capabilities: {
			textDocumentSync: {
				openClose: true,
				change: TextDocumentSyncKind.Incremental,
				willSaveWaitUntil: true,
				save: {
					includeText: false
				}
			},
			codeActionProvider: true,
			executeCommandProvider: {
				commands: [
					CommandIds.applySingleFix,
					CommandIds.applySameFixes,
					CommandIds.applyAllFixes,
					CommandIds.applyAutoFix,
					CommandIds.applyDisableLine,
					CommandIds.applyDisableFile,
					CommandIds.openRuleDoc,
				]
			}
		}
	};
});

connection.onInitialized(() => {
	connection.client.register(DidChangeConfigurationNotification.type, undefined);
	connection.client.register(DidChangeWorkspaceFoldersNotification.type, undefined);
});

messageQueue.registerNotification(DidChangeConfigurationNotification.type, (_params) => {
	environmentChanged();
});

messageQueue.registerNotification(DidChangeWorkspaceFoldersNotification.type, (_params) => {
	environmentChanged();
});

const singleErrorHandlers: ((error: any, document: TextDocument, library: ESLintModule) => Status)[] = [
	tryHandleNoConfig,
	tryHandleConfigError,
	tryHandleMissingModule,
	showErrorMessage
];

function validateSingle(document: TextDocument, publishDiagnostics: boolean = true): Thenable<void> {
	// We validate document in a queue but open / close documents directly. So we need to deal with the
	// fact that a document might be gone from the server.
	if (!documents.get(document.uri)) {
		return Promise.resolve(undefined);
	}
	return resolveSettings(document).then((settings) => {
		if (!settings.validate) {
			return;
		}
		try {
			validate(document, settings, publishDiagnostics);
			connection.sendNotification(StatusNotification.type, { state: Status.ok });
		} catch (err) {
			let status = undefined;
			for (let handler of singleErrorHandlers) {
				status = handler(err, document, settings.library);
				if (status) {
					break;
				}
			}
			status = status || Status.error;
			connection.sendNotification(StatusNotification.type, { state: status });
		}
	});
}

function validateMany(documents: TextDocument[]): void {
	documents.forEach(document => {
		messageQueue.addNotificationMessage(ValidateNotification.type, document, document.version);
	});
}

function getMessage(err: any, document: TextDocument): string {
	let result: string = null;
	if (typeof err.message === 'string' || err.message instanceof String) {
		result = <string>err.message;
		result = result.replace(/\r?\n/g, ' ');
		if (/^CLI: /.test(result)) {
			result = result.substr(5);
		}
	} else {
		result = `An unknown error occurred while validating document: ${document.uri}`;
	}
	return result;
}

let ruleDocData: {
	handled: Set<string>;
	urls: Map<string, string>;
} = {
	handled: new Set<string>(),
	urls: new Map<string, string>()
};


const validFixTypes = new Set<string>(['problem', 'suggestion', 'layout']);
function validate(document: TextDocument, settings: TextDocumentSettings, publishDiagnostics: boolean = true): void {
	let newOptions: CLIOptions = Object.assign(Object.create(null), settings.options);
	let fixTypes: Set<string> | undefined = undefined;
	if (Array.isArray(newOptions.fixTypes) && newOptions.fixTypes.length > 0) {
		fixTypes = new Set();
		for (let item of newOptions.fixTypes) {
			if (validFixTypes.has(item)) {
				fixTypes.add(item);
			}
		}
		if (fixTypes.size === 0) {
			fixTypes = undefined;
		}
	}
	let content = document.getText();
	let uri = document.uri;
	let file = getFilePath(document);
	let cwd = process.cwd();

	try {
		if (file) {
			if (settings.workingDirectory) {
				newOptions.cwd = settings.workingDirectory.directory;
				if (settings.workingDirectory.changeProcessCWD) {
					process.chdir(settings.workingDirectory.directory);
				}
			} else if (settings.workspaceFolder) {
				let workspaceFolderUri = URI.parse(settings.workspaceFolder.uri);
				if (workspaceFolderUri.scheme === 'file') {
					const fsPath = getFileSystemPath(workspaceFolderUri);
					newOptions.cwd = fsPath;
					process.chdir(fsPath);
				}
			} else if (!settings.workspaceFolder && !isUNC(file)) {
				let directory = path.dirname(file);
				if (directory) {
					if (path.isAbsolute(directory)) {
						newOptions.cwd = directory;
					}
				}
			}
		}

		let cli = new settings.library.CLIEngine(newOptions);
		// Clean previously computed code actions.
		codeActions.delete(uri);
		let report: ESLintReport = cli.executeOnText(content, file);
		let diagnostics: Diagnostic[] = [];
		if (report && report.results && Array.isArray(report.results) && report.results.length > 0) {
			let docReport = report.results[0];
			if (docReport.messages && Array.isArray(docReport.messages)) {
				docReport.messages.forEach((problem) => {
					if (problem) {
						const isWarning = convertSeverity(problem.severity) === DiagnosticSeverity.Warning;
						if (settings.quiet && isWarning) {
							// Filter out warnings when quiet mode is enabled
							return;
						}
						let diagnostic = makeDiagnostic(problem);
						diagnostics.push(diagnostic);
						if (settings.autoFix) {
							if (fixTypes !== undefined && isFunction(cli.getRules) && problem.ruleId !== undefined && problem.fix !== undefined) {
								let rule = cli.getRules().get(problem.ruleId);
								if (rule !== undefined && fixTypes.has(rule.meta.type)) {
									recordCodeAction(document, diagnostic, problem);
								}
							} else {
								recordCodeAction(document, diagnostic, problem);
							}
						}
					}
				});
			}
		}
		if (publishDiagnostics) {
			connection.sendDiagnostics({ uri, diagnostics });
		}

		// cache documentation urls for all rules
		if (isFunction(cli.getRules) && !ruleDocData.handled.has(uri)) {
			ruleDocData.handled.add(uri);
			cli.getRules().forEach((rule, key) => {
				if (rule.meta && rule.meta.docs && Is.string(rule.meta.docs.url)) {
					ruleDocData.urls.set(key, rule.meta.docs.url);
				}
			});
		}
	} finally {
		if (cwd !== process.cwd()) {
			process.chdir(cwd);
		}
	}
}

let noConfigReported: Map<string, ESLintModule> = new Map<string, ESLintModule>();

function isNoConfigFoundError(error: any): boolean {
	let candidate = error as ESLintError;
	return candidate.messageTemplate === 'no-config-found' || candidate.message === 'No ESLint configuration found.';
}

function tryHandleNoConfig(error: any, document: TextDocument, library: ESLintModule): Status {
	if (!isNoConfigFoundError(error)) {
		return undefined;
	}
	if (!noConfigReported.has(document.uri)) {
		connection.sendRequest(
			NoConfigRequest.type,
			{
				message: getMessage(error, document),
				document: {
					uri: document.uri
				}
			})
		.then(undefined, () => { });
		noConfigReported.set(document.uri, library);
	}
	return Status.warn;
}

let configErrorReported: Map<string, ESLintModule> = new Map<string, ESLintModule>();

function tryHandleConfigError(error: any, document: TextDocument, library: ESLintModule): Status {
	if (!error.message) {
		return undefined;
	}

	function handleFileName(filename: string): Status {
		if (!configErrorReported.has(filename)) {
			connection.console.error(getMessage(error, document));
			if (!documents.get(URI.file(filename).toString())) {
				connection.window.showInformationMessage(getMessage(error, document));
			}
			configErrorReported.set(filename, library);
		}
		return Status.warn;
	}

	let matches = /Cannot read config file:\s+(.*)\nError:\s+(.*)/.exec(error.message);
	if (matches && matches.length === 3) {
		return handleFileName(matches[1]);
	}

	matches = /(.*):\n\s*Configuration for rule \"(.*)\" is /.exec(error.message);
	if (matches && matches.length === 3) {
		return handleFileName(matches[1]);
	}

	matches = /Cannot find module '([^']*)'\nReferenced from:\s+(.*)/.exec(error.message);
	if (matches && matches.length === 3) {
		return handleFileName(matches[2]);
	}

	return undefined;
}

let missingModuleReported: Map<string, ESLintModule> = new Map<string, ESLintModule>();

function tryHandleMissingModule(error: any, document: TextDocument, library: ESLintModule): Status {
	if (!error.message) {
		return undefined;
	}

	function handleMissingModule(plugin: string, module: string, error: ESLintError): Status {
		if (!missingModuleReported.has(plugin)) {
			let fsPath = getFilePath(document);
			missingModuleReported.set(plugin, library);
			if (error.messageTemplate === 'plugin-missing') {
				connection.console.error([
					'',
					`${error.message.toString()}`,
					`Happened while validating ${fsPath ? fsPath : document.uri}`,
					`This can happen for a couple of reasons:`,
					`1. The plugin name is spelled incorrectly in an ESLint configuration file (e.g. .eslintrc).`,
					`2. If ESLint is installed globally, then make sure ${module} is installed globally as well.`,
					`3. If ESLint is installed locally, then ${module} isn't installed correctly.`,
					'',
					`Consider running eslint --debug ${fsPath ? fsPath : document.uri} from a terminal to obtain a trace about the configuration files used.`
				].join('\n'));
			} else {
				connection.console.error([
					`${error.message.toString()}`,
					`Happened while validating ${fsPath ? fsPath : document.uri}`
				].join('\n'));
			}
		}
		return Status.warn;
	}

	let matches = /Failed to load plugin (.*): Cannot find module (.*)/.exec(error.message);
	if (matches && matches.length === 3) {
		return handleMissingModule(matches[1], matches[2], error);
	}

	return undefined;
}

function showErrorMessage(error: any, document: TextDocument): Status {
	connection.window.showErrorMessage(`ESLint: ${getMessage(error, document)}. Please see the 'ESLint' output channel for details.`);
	if (Is.string(error.stack)) {
		connection.console.error('ESLint stack trace:');
		connection.console.error(error.stack);
	}
	return Status.error;
}

messageQueue.registerNotification(DidChangeWatchedFilesNotification.type, (params) => {
	// A .eslintrc has change. No smartness here.
	// Simply revalidate all file.
	ruleDocData.handled.clear();
	ruleDocData.urls.clear();
	noConfigReported = new Map<string, ESLintModule>();
	missingModuleReported = new Map<string, ESLintModule>();
	params.changes.forEach((change) => {
		let fsPath = getFilePath(change.uri);
		if (!fsPath || isUNC(fsPath)) {
			return;
		}
		let dirname = path.dirname(fsPath);
		if (dirname) {
			let library = configErrorReported.get(fsPath);
			if (library) {
				let cli = new library.CLIEngine({});
				try {
					cli.executeOnText("", path.join(dirname, "___test___.js"));
					configErrorReported.delete(fsPath);
				} catch (error) {
				}
			}
		}
	});
	validateMany(documents.all());
});

class Fixes {
	constructor (private edits: Map<string, FixableProblem>) {
	}

	public static overlaps(lastEdit: FixableProblem, newEdit: FixableProblem): boolean {
		return !!lastEdit && !!lastEdit.edit && lastEdit.edit.range[1] > newEdit.edit.range[0];
	}

	public isEmpty(): boolean {
		return this.edits.size === 0;
	}

	public getDocumentVersion(): number {
		if (this.isEmpty()) {
			throw new Error('No edits recorded.');
		}
		return this.edits.values().next().value.documentVersion;
	}

	public getScoped(diagnostics: Diagnostic[]): FixableProblem[] {
		let result: FixableProblem[] = [];
		for(let diagnostic of diagnostics) {
			let key = computeKey(diagnostic);
			let editInfo = this.edits.get(key);
			if (editInfo) {
				result.push(editInfo);
			}
		}
		return result;
	}

	public getAllSorted(): FixableProblem[] {
		let result: FixableProblem[] = [];
		this.edits.forEach((value) => {
			if (!!value.edit) {
				result.push(value);
			}
		});
		return result.sort((a, b) => {
			let d = a.edit.range[0] - b.edit.range[0];
			if (d !== 0) {
				return d;
			}
			if (a.edit.range[1] === 0) {
				return -1;
			}
			if (b.edit.range[1] === 0) {
				return 1;
			}
			return a.edit.range[1] - b.edit.range[1];
		});
	}

	public getOverlapFree(): FixableProblem[] {
		let sorted = this.getAllSorted();
		if (sorted.length <= 1) {
			return sorted;
		}
		let result: FixableProblem[] = [];
		let last: FixableProblem = sorted[0];
		result.push(last);
		for (let i = 1; i < sorted.length; i++) {
			let current = sorted[i];
			if (!Fixes.overlaps(last, current)) {
				result.push(current);
				last = current;
			}
		}
		return result;
	}
}

interface RuleCodeActions {
	fixes: CodeAction[];
	disable?: CodeAction;
	fixAll?: CodeAction;
	disableFile?: CodeAction;
	showDocumentation?: CodeAction;
}

class CodeActionResult {
	private _actions: Map<string, RuleCodeActions>;
	private _fixAll: CodeAction | undefined;

	public constructor() {
		this._actions = new Map();
	}

	public get(ruleId: string): RuleCodeActions {
		let result: RuleCodeActions = this._actions.get(ruleId);
		if (result === undefined) {
			result = { fixes: [] };
			this._actions.set(ruleId, result);
		}
		return result;
	}

	public set fixAll(action: CodeAction) {
		this._fixAll = action;
	}

	public all(): CodeAction[] {
		let result: CodeAction[] = [];
		for (let actions of this._actions.values()) {
			result.push(...actions.fixes);
			if (actions.disable) {
				result.push(actions.disable);
			}
			if (actions.fixAll) {
				result.push(actions.fixAll);
			}
			if (actions.disableFile) {
				result.push(actions.disableFile);
			}
			if (actions.showDocumentation) {
				result.push(actions.showDocumentation);
			}
		}
		if (this._fixAll !== undefined) {
			result.push(this._fixAll);
		}
		return result;
	}

	public get length(): number {
		let result: number = 0;
		for (let actions of this._actions.values()) {
			result += actions.fixes.length;
		}
		return result;
	}
}

let commands: Map<string, WorkspaceChange>;
messageQueue.registerRequest(CodeActionRequest.type, (params) => {
	commands = new Map<string, WorkspaceChange>();
	let result: CodeActionResult = new CodeActionResult();
	let uri = params.textDocument.uri;
	let edits = codeActions.get(uri);
	if (!edits) {
		return result.all();
	}

	let fixes = new Fixes(edits);
	if (fixes.isEmpty()) {
		return result.all();
	}

	let textDocument = documents.get(uri);
	let documentVersion: number = -1;
	let allFixableRuleIds: string[] = [];

	function createTextEdit(editInfo: FixableProblem): TextEdit {
		return TextEdit.replace(Range.create(textDocument.positionAt(editInfo.edit.range[0]), textDocument.positionAt(editInfo.edit.range[1])), editInfo.edit.text || '');
	}

	function createDisableLineTextEdit(editInfo: FixableProblem, indentationText: string): TextEdit {
		return TextEdit.insert(Position.create(editInfo.line - 1, 0), `${indentationText}// eslint-disable-next-line ${editInfo.ruleId}${EOL}`);
	}

	function createDisableSameLineTextEdit(editInfo: FixableProblem): TextEdit {
		return TextEdit.insert(Position.create(editInfo.line - 1, Number.MAX_VALUE), ` // eslint-disable-line ${editInfo.ruleId}`);
	}

	function createDisableFileTextEdit(editInfo: FixableProblem): TextEdit {
		return TextEdit.insert(Position.create(0, 0), `/* eslint-disable ${editInfo.ruleId} */${EOL}`);
	}

	function getLastEdit(array: FixableProblem[]): FixableProblem {
		let length = array.length;
		if (length === 0) {
			return undefined;
		}
		return array[length - 1];
	}

	return resolveSettings(textDocument).then((settings) => {
		for (let editInfo of fixes.getScoped(params.context.diagnostics)) {
			documentVersion = editInfo.documentVersion;
			let ruleId = editInfo.ruleId;
			allFixableRuleIds.push(ruleId);

			if (!!editInfo.edit) {
				let workspaceChange = new WorkspaceChange();
				workspaceChange.getTextEditChange({uri, version: documentVersion}).add(createTextEdit(editInfo));
				commands.set(`${CommandIds.applySingleFix}:${ruleId}`, workspaceChange);
				result.get(ruleId).fixes.push(CodeAction.create(
					editInfo.label,
					Command.create(editInfo.label, CommandIds.applySingleFix, ruleId),
					CodeActionKind.QuickFix
				));
			}

			if (settings.codeAction.disableRuleComment.enable) {
				let workspaceChange = new WorkspaceChange();
				if (settings.codeAction.disableRuleComment.location === 'sameLine') {
					workspaceChange.getTextEditChange({uri, version: documentVersion}).add(createDisableSameLineTextEdit(editInfo));
				} else {
					let lineText = textDocument.getText(Range.create(Position.create(editInfo.line - 1, 0), Position.create(editInfo.line - 1, Number.MAX_VALUE)));
					let indentationText = /^([ \t]*)/.exec(lineText)[1];
					workspaceChange.getTextEditChange({uri, version: documentVersion}).add(createDisableLineTextEdit(editInfo, indentationText));
				}
				commands.set(`${CommandIds.applyDisableLine}:${ruleId}`, workspaceChange);
				let title = `Disable ${ruleId} for this line`;
				result.get(ruleId).disable = CodeAction.create(
					title,
					Command.create(title, CommandIds.applyDisableLine, ruleId),
					CodeActionKind.QuickFix
				);

				if (result.get(ruleId).disableFile === undefined) {
					workspaceChange = new WorkspaceChange();
					workspaceChange.getTextEditChange({uri, version: documentVersion}).add(createDisableFileTextEdit(editInfo));
					commands.set(`${CommandIds.applyDisableFile}:${ruleId}`, workspaceChange);
					title = `Disable ${ruleId} for the entire file`;
					result.get(ruleId).disableFile = CodeAction.create(
						title,
						Command.create(title, CommandIds.applyDisableFile, ruleId),
						CodeActionKind.QuickFix
					);
				}
			}

			if (settings.codeAction.showDocumentation.enable && result.get(ruleId).showDocumentation === undefined) {
				if (ruleDocData.urls.has(ruleId)) {
					let title = `Show documentation for ${ruleId}`;
					result.get(ruleId).showDocumentation = CodeAction.create(
						title,
						Command.create(title, CommandIds.openRuleDoc, ruleId),
						CodeActionKind.QuickFix
					);
				}
			}
		}

		if (result.length > 0) {
			let sameProblems: Map<string, FixableProblem[]> = new Map<string, FixableProblem[]>(allFixableRuleIds.map<[string, FixableProblem[]]>(s => [s, []]));
			let all: FixableProblem[] = [];

			for (let editInfo of fixes.getAllSorted()) {
				if (documentVersion === -1) {
					documentVersion = editInfo.documentVersion;
				}
				if (sameProblems.has(editInfo.ruleId)) {
					let same = sameProblems.get(editInfo.ruleId);
					if (!Fixes.overlaps(getLastEdit(same), editInfo)) {
						same.push(editInfo);
					}
				}
				if (!Fixes.overlaps(getLastEdit(all), editInfo)) {
					all.push(editInfo);
				}
			}
			sameProblems.forEach((same, ruleId) => {
				if (same.length > 1) {
					let sameFixes: WorkspaceChange = new WorkspaceChange();
					let sameTextChange = sameFixes.getTextEditChange({uri, version: documentVersion});
					same.map(createTextEdit).forEach(edit => sameTextChange.add(edit));
					commands.set(CommandIds.applySameFixes, sameFixes);
					let title = `Fix all ${ruleId} problems`;
					let command = Command.create(title, CommandIds.applySameFixes);
					result.get(ruleId).fixAll = CodeAction.create(
						title,
						command,
						CodeActionKind.QuickFix
					);
				}
			});
			if (all.length > 1) {
				let allFixes: WorkspaceChange = new WorkspaceChange();
				let allTextChange = allFixes.getTextEditChange({uri, version: documentVersion});
				all.map(createTextEdit).forEach(edit => allTextChange.add(edit));
				commands.set(CommandIds.applyAllFixes, allFixes);
				let title = `Fix all auto-fixable problems`;
				let command = Command.create(title, CommandIds.applyAllFixes);
				result.fixAll = CodeAction.create(
					title,
					command,
					CodeActionKind.QuickFix
				);
			}
		}
		return result.all();
	});
}, (params): number => {
	let document = documents.get(params.textDocument.uri);
	return document ? document.version : undefined;
});

function computeAllFixes(identifier: VersionedTextDocumentIdentifier): TextEdit[] {
	let uri = identifier.uri;
	let textDocument = documents.get(uri);
	if (!textDocument || identifier.version !== textDocument.version) {
		return undefined;
	}
	let edits = codeActions.get(uri);
	function createTextEdit(editInfo: FixableProblem): TextEdit {
		return TextEdit.replace(Range.create(textDocument.positionAt(editInfo.edit.range[0]), textDocument.positionAt(editInfo.edit.range[1])), editInfo.edit.text || '');
	}

	if (edits) {
		let fixes = new Fixes(edits);
		if (!fixes.isEmpty()) {
			return fixes.getOverlapFree().filter(fix => !!fix.edit).map(createTextEdit);
		}
	}
	return undefined;
}

messageQueue.registerRequest(ExecuteCommandRequest.type, (params) => {
	let workspaceChange: WorkspaceChange;
	if (params.command === CommandIds.applyAutoFix) {
		let identifier: VersionedTextDocumentIdentifier = params.arguments[0];
		let edits = computeAllFixes(identifier);
		if (edits) {
			workspaceChange = new WorkspaceChange();
			let textChange = workspaceChange.getTextEditChange(identifier);
			edits.forEach(edit => textChange.add(edit));
		}
	} else {
		if ([CommandIds.applySingleFix, CommandIds.applyDisableLine, CommandIds.applyDisableFile].indexOf(params.command) !== -1) {
			let ruleId = params.arguments[0];
			workspaceChange = commands.get(`${params.command}:${ruleId}`);
		} else if (params.command === CommandIds.openRuleDoc) {
			let ruleId = params.arguments[0];
			let url = ruleDocData.urls.get(ruleId);
			if (url) {
				connection.sendRequest(OpenESLintDocRequest.type, { url });
			}
		} else {
			workspaceChange = commands.get(params.command);
		}
	}

	if (!workspaceChange) {
		return {};
	}
	return connection.workspace.applyEdit(workspaceChange.edit).then((response) => {
		if (!response.applied) {
			connection.console.error(`Failed to apply command: ${params.command}`);
		}
		return {};
	}, () => {
		connection.console.error(`Failed to apply command: ${params.command}`);
	});
}, (params): number => {
	if (params.command === CommandIds.applyAutoFix) {
		let identifier: VersionedTextDocumentIdentifier = params.arguments[0];
		return identifier.version;
	} else {
		return undefined;
	}
});

connection.tracer.
connection.listen();