'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const os = require("os");
const fs = require("fs");
const vscode_1 = require("vscode");
const vscode_languageclient_1 = require("vscode-languageclient");
const plugin_1 = require("./plugin");
const javaServerStarter_1 = require("./javaServerStarter");
const requirements = require("./requirements");
const commands_1 = require("./commands");
const protocol_1 = require("./protocol");
const buildpath = require("./buildpath");
const sourceAction = require("./sourceAction");
const refactorAction = require("./refactorAction");
const net = require("net");
const utils_1 = require("./utils");
const settings_1 = require("./settings");
const log_1 = require("./log");
let lastStatus;
let languageClient;
const jdtEventEmitter = new vscode_1.EventEmitter();
const cleanWorkspaceFileName = '.cleanWorkspace';
let clientLogFile;
function activate(context) {
	let storagePath = context.storagePath;

    if (!storagePath) {
        storagePath = getTempWorkspace();
	}
    clientLogFile = path.join(storagePath, 'client.log');
    log_1.initializeLogFile(clientLogFile);
    enableJavadocSymbols();
    return requirements.resolveRequirements().catch(error => {
        // show error
        vscode_1.window.showErrorMessage(error.message, error.label).then((selection) => {
            if (error.label && error.label === selection && error.command) {
                vscode_1.commands.executeCommand(error.command, error.commandParam);
            }
        });
        // rethrow to disrupt the chain.
        throw error;
    }).then(requirements => {
        return vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window }, p => {
            return new Promise((resolve, reject) => {
                const workspacePath = path.resolve(storagePath + '/jdt_ws');
                // Options to control the language client
                const clientOptions = {
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
                        bundles: plugin_1.collectJavaExtensions(vscode_1.extensions.all),
                        workspaceFolders: vscode_1.workspace.workspaceFolders ? vscode_1.workspace.workspaceFolders.map(f => f.uri.toString()) : null,
                        settings: { java: utils_1.getJavaConfiguration() },
                        extendedClientCapabilities: {
                            progressReportProvider: utils_1.getJavaConfiguration().get('progressReports.enabled'),
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
                    revealOutputChannelOn: vscode_languageclient_1.RevealOutputChannelOn.Never
                };
                const item = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Right, Number.MIN_VALUE);
                item.text = '$(sync~spin)';
                item.command = commands_1.Commands.OPEN_OUTPUT;
                const progressBar = vscode_1.window.createStatusBarItem(vscode_1.StatusBarAlignment.Left, Number.MIN_VALUE + 1);
                let serverOptions;
                const port = process.env['SERVER_PORT'];
                if (!port) {
                    const lsPort = process.env['JDTLS_CLIENT_PORT'];
                    if (!lsPort) {
                        serverOptions = javaServerStarter_1.prepareExecutable(requirements, workspacePath, utils_1.getJavaConfiguration());
                    }
                    else {
                        serverOptions = () => {
                            const socket = net.connect(lsPort);
                            const result = {
                                writer: socket,
                                reader: socket
                            };
                            return Promise.resolve(result);
                        };
                    }
                }
                else {
                    // used during development
                    serverOptions = javaServerStarter_1.awaitServerConnection.bind(null, port);
                }
                // Create the language client and start the client.
                languageClient = new vscode_languageclient_1.LanguageClient('java', 'Language Support for Java', serverOptions, clientOptions);
                languageClient.registerProposedFeatures();
                languageClient.onReady().then(() => {
                    languageClient.onNotification(protocol_1.StatusNotification.type, (report) => {
                        switch (report.type) {
                            case 'Started':
                                item.text = '$(thumbsup)';
                                p.report({ message: 'Finished' });
                                lastStatus = item.text;
                                vscode_1.commands.executeCommand('setContext', 'javaLSReady', true);
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
                                toggleItem(vscode_1.window.activeTextEditor, item);
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
                        toggleItem(vscode_1.window.activeTextEditor, item);
                    });
                    languageClient.onNotification(protocol_1.ProgressReportNotification.type, (progress) => {
                        progressBar.show();
                        progressBar.text = progress.status;
                        if (progress.complete) {
                            setTimeout(() => { progressBar.hide(); }, 500);
                        }
                    });
                    languageClient.onNotification(protocol_1.ActionableNotification.type, (notification) => {
                        let show = null;
                        switch (notification.severity) {
                            case protocol_1.MessageType.Log:
                                show = logNotification;
                                break;
                            case protocol_1.MessageType.Info:
                                show = vscode_1.window.showInformationMessage;
                                break;
                            case protocol_1.MessageType.Warning:
                                show = vscode_1.window.showWarningMessage;
                                break;
                            case protocol_1.MessageType.Error:
                                show = vscode_1.window.showErrorMessage;
                                break;
                        }
                        if (!show) {
                            return;
                        }
                        const titles = notification.commands.map(a => a.title);
                        show(notification.message, ...titles).then((selection) => {
                            for (const action of notification.commands) {
                                if (action.title === selection) {
                                    const args = (action.arguments) ? action.arguments : [];
                                    vscode_1.commands.executeCommand(action.command, ...args);
                                    break;
                                }
                            }
                        });
                    });
                    languageClient.onRequest(protocol_1.ExecuteClientCommandRequest.type, (params) => {
                        return vscode_1.commands.executeCommand(params.command, ...params.arguments);
                    });
                    languageClient.onRequest(protocol_1.SendNotificationRequest.type, (params) => {
                        return vscode_1.commands.executeCommand(params.command, ...params.arguments);
                    });
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.SHOW_JAVA_REFERENCES, (uri, position, locations) => {
                        vscode_1.commands.executeCommand(commands_1.Commands.SHOW_REFERENCES, vscode_1.Uri.parse(uri), languageClient.protocol2CodeConverter.asPosition(position), locations.map(languageClient.protocol2CodeConverter.asLocation));
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.SHOW_JAVA_IMPLEMENTATIONS, (uri, position, locations) => {
                        vscode_1.commands.executeCommand(commands_1.Commands.SHOW_REFERENCES, vscode_1.Uri.parse(uri), languageClient.protocol2CodeConverter.asPosition(position), locations.map(languageClient.protocol2CodeConverter.asLocation));
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.CONFIGURATION_UPDATE, uri => projectConfigurationUpdate(languageClient, uri)));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.IGNORE_INCOMPLETE_CLASSPATH, (data) => setIncompleteClasspathSeverity('ignore')));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.IGNORE_INCOMPLETE_CLASSPATH_HELP, (data) => {
                        vscode_1.commands.executeCommand(commands_1.Commands.OPEN_BROWSER, vscode_1.Uri.parse('https://github.com/redhat-developer/vscode-java/wiki/%22Classpath-is-incomplete%22-warning'));
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.PROJECT_CONFIGURATION_STATUS, (uri, status) => setProjectConfigurationUpdate(languageClient, uri, status)));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.APPLY_WORKSPACE_EDIT, (obj) => {
                        applyWorkspaceEdit(obj, languageClient);
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, (command, ...rest) => {
                        const params = {
                            command,
                            arguments: rest
                        };
                        return languageClient.sendRequest(vscode_languageclient_1.ExecuteCommandRequest.type, params);
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.COMPILE_WORKSPACE, (isFullCompile) => {
                        return vscode_1.window.withProgress({ location: vscode_1.ProgressLocation.Window }, (p) => __awaiter(this, void 0, void 0, function* () {
                            if (typeof isFullCompile !== 'boolean') {
                                const selection = yield vscode_1.window.showQuickPick(['Incremental', 'Full'], { placeHolder: 'please choose compile type:' });
                                isFullCompile = selection !== 'Incremental';
                            }
                            p.report({ message: 'Compiling workspace...' });
                            const start = new Date().getTime();
                            const res = yield languageClient.sendRequest(protocol_1.CompileWorkspaceRequest.type, isFullCompile);
                            const elapsed = new Date().getTime() - start;
                            const humanVisibleDelay = elapsed < 1000 ? 1000 : 0;
                            return new Promise((resolve, reject) => {
                                setTimeout(() => {
                                    if (res === protocol_1.CompileWorkspaceStatus.SUCCEED) {
                                        resolve(res);
                                    }
                                    else {
                                        reject(res);
                                    }
                                }, humanVisibleDelay);
                            });
                        }));
                    }));
                    context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.UPDATE_SOURCE_ATTACHMENT, (classFileUri) => __awaiter(this, void 0, void 0, function* () {
                        const resolveRequest = {
                            classFileUri: classFileUri.toString(),
                        };
                        const resolveResult = yield vscode_1.commands.executeCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, commands_1.Commands.RESOLVE_SOURCE_ATTACHMENT, JSON.stringify(resolveRequest));
                        if (resolveResult.errorMessage) {
                            vscode_1.window.showErrorMessage(resolveResult.errorMessage);
                            return false;
                        }
                        const attributes = resolveResult.attributes || {};
                        const defaultPath = attributes.sourceAttachmentPath || attributes.jarPath;
                        const sourceFileUris = yield vscode_1.window.showOpenDialog({
                            defaultUri: defaultPath ? vscode_1.Uri.file(defaultPath) : null,
                            openLabel: 'Select Source File',
                            canSelectFiles: true,
                            canSelectFolders: false,
                            canSelectMany: false,
                            filters: {
                                'Source files': ['jar', 'zip']
                            },
                        });
                        if (sourceFileUris && sourceFileUris.length) {
                            const updateRequest = {
                                classFileUri: classFileUri.toString(),
                                attributes: Object.assign({}, attributes, { sourceAttachmentPath: sourceFileUris[0].fsPath }),
                            };
                            const updateResult = yield vscode_1.commands.executeCommand(commands_1.Commands.EXECUTE_WORKSPACE_COMMAND, commands_1.Commands.UPDATE_SOURCE_ATTACHMENT, JSON.stringify(updateRequest));
                            if (updateResult.errorMessage) {
                                vscode_1.window.showErrorMessage(updateResult.errorMessage);
                                return false;
                            }
                            // Notify jdt content provider to rerender the classfile contents.
                            jdtEventEmitter.fire(classFileUri);
                            return true;
                        }
                    })));
                    buildpath.registerCommands(context);
                    sourceAction.registerCommands(languageClient, context);
                    refactorAction.registerCommands(languageClient, context);
                    context.subscriptions.push(vscode_1.window.onDidChangeActiveTextEditor((editor) => {
                        toggleItem(editor, item);
                    }));
                    const provider = {
                        onDidChange: jdtEventEmitter.event,
                        provideTextDocumentContent: (uri, token) => {
                            return languageClient.sendRequest(protocol_1.ClassFileContentsRequest.type, { uri: uri.toString() }, token).then((v) => {
                                return v || '';
                            });
                        }
                    };
                    context.subscriptions.push(vscode_1.workspace.registerTextDocumentContentProvider('jdt', provider));
                    if (vscode_1.extensions.onDidChange) { // Theia doesn't support this API yet
                        vscode_1.extensions.onDidChange(() => {
                            plugin_1.onExtensionChange(vscode_1.extensions.all);
                        });
                    }
                    settings_1.excludeProjectSettingsFiles();
                });
                const cleanWorkspaceExists = fs.existsSync(path.join(workspacePath, cleanWorkspaceFileName));
                if (cleanWorkspaceExists) {
                    try {
                        deleteDirectory(workspacePath);
                    }
                    catch (error) {
                        vscode_1.window.showErrorMessage(`Failed to delete ${workspacePath}: ${error}`);
                    }
                }
                languageClient.start();
                // Register commands here to make it available even when the language client fails
                context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.OPEN_OUTPUT, () => languageClient.outputChannel.show(vscode_1.ViewColumn.Three)));
                context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.OPEN_SERVER_LOG, () => openServerLogFile(workspacePath)));
                context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.OPEN_CLIENT_LOG, () => openClientLogFile(clientLogFile)));
                const extensionPath = context.extensionPath;
                context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.OPEN_FORMATTER, () => __awaiter(this, void 0, void 0, function* () { return openFormatter(extensionPath); })));
                context.subscriptions.push(vscode_1.commands.registerCommand(commands_1.Commands.CLEAN_WORKSPACE, () => cleanWorkspace(workspacePath)));
                context.subscriptions.push(settings_1.onConfigurationChange());
                toggleItem(vscode_1.window.activeTextEditor, item);
            });
        });
    });
}
exports.activate = activate;
function deactivate() {
    if (!languageClient) {
        return undefined;
    }
    return languageClient.stop();
}
exports.deactivate = deactivate;
function enableJavadocSymbols() {
    // Let's enable Javadoc symbols autocompletion, shamelessly copied from MIT licensed code at
    // https://github.com/Microsoft/vscode/blob/9d611d4dfd5a4a101b5201b8c9e21af97f06e7a7/extensions/typescript/src/typescriptMain.ts#L186
    vscode_1.languages.setLanguageConfiguration('java', {
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
                action: { indentAction: vscode_1.IndentAction.IndentOutdent, appendText: ' * ' }
            },
            {
                // e.g. /** ...|
                beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/,
                action: { indentAction: vscode_1.IndentAction.None, appendText: ' * ' }
            },
            {
                // e.g.  * ...|
                beforeText: /^(\t|(\ \ ))*\ \*(\ ([^\*]|\*(?!\/))*)?$/,
                action: { indentAction: vscode_1.IndentAction.None, appendText: '* ' }
            },
            {
                // e.g.  */|
                beforeText: /^(\t|(\ \ ))*\ \*\/\s*$/,
                action: { indentAction: vscode_1.IndentAction.None, removeText: 1 }
            },
            {
                // e.g.  *-----*/|
                beforeText: /^(\t|(\ \ ))*\ \*[^/]*\*\/\s*$/,
                action: { indentAction: vscode_1.IndentAction.None, removeText: 1 }
            }
        ]
    });
}
function logNotification(message, ...items) {
    return new Promise((resolve, reject) => {
        log_1.logger.verbose(message);
    });
}
function setIncompleteClasspathSeverity(severity) {
    const config = utils_1.getJavaConfiguration();
    const section = 'errors.incompleteClasspath.severity';
    config.update(section, severity, true).then(() => log_1.logger.info(`${section} globally set to ${severity}`), (error) => log_1.logger.error(error));
}
function projectConfigurationUpdate(languageClient, uri) {
    let resource = uri;
    if (!(resource instanceof vscode_1.Uri)) {
        if (vscode_1.window.activeTextEditor) {
            resource = vscode_1.window.activeTextEditor.document.uri;
        }
    }
    if (!resource) {
        return vscode_1.window.showWarningMessage('No Java project to update!').then(() => false);
    }
    if (isJavaConfigFile(resource.path)) {
        languageClient.sendNotification(protocol_1.ProjectConfigurationUpdateRequest.type, {
            uri: resource.toString()
        });
    }
}
function setProjectConfigurationUpdate(languageClient, uri, status) {
    const config = utils_1.getJavaConfiguration();
    const section = 'configuration.updateBuildConfiguration';
    const st = protocol_1.FeatureStatus[status];
    config.update(section, st).then(() => log_1.logger.info(`${section} set to ${st}`), (error) => log_1.logger.error(error));
    if (status !== protocol_1.FeatureStatus.disabled) {
        projectConfigurationUpdate(languageClient, uri);
    }
}
function toggleItem(editor, item) {
    if (editor && editor.document &&
        (editor.document.languageId === 'java' || isJavaConfigFile(editor.document.uri.path))) {
        item.show();
    }
    else {
        item.hide();
    }
}
function isJavaConfigFile(path) {
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
function cleanWorkspace(workspacePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const doIt = 'Restart and delete';
        vscode_1.window.showWarningMessage('Are you sure you want to clean the Java language server workspace?', 'Cancel', doIt).then(selection => {
            if (selection === doIt) {
                const file = path.join(workspacePath, cleanWorkspaceFileName);
                fs.closeSync(fs.openSync(file, 'w'));
                vscode_1.commands.executeCommand(commands_1.Commands.RELOAD_WINDOW);
            }
        });
    });
}
function deleteDirectory(dir) {
    if (fs.existsSync(dir)) {
        fs.readdirSync(dir).forEach((child) => {
            const entry = path.join(dir, child);
            if (fs.lstatSync(entry).isDirectory()) {
                deleteDirectory(entry);
            }
            else {
                fs.unlinkSync(entry);
            }
        });
        fs.rmdirSync(dir);
    }
}
function openServerLogFile(workspacePath) {
    const serverLogFile = path.join(workspacePath, '.metadata', '.log');
    return openLogFile(serverLogFile, 'Could not open Java Language Server log file');
}
function openClientLogFile(logFile) {
    return openLogFile(logFile, 'Could not open Java extension log file');
}
function openLogFile(logFile, openingFailureWarning) {
    if (!fs.existsSync(logFile)) {
        return vscode_1.window.showWarningMessage('No log file available').then(() => false);
    }
    return vscode_1.workspace.openTextDocument(logFile)
        .then(doc => {
        if (!doc) {
            return false;
        }
        return vscode_1.window.showTextDocument(doc, vscode_1.window.activeTextEditor ?
            vscode_1.window.activeTextEditor.viewColumn : undefined)
            .then(editor => !!editor);
    }, () => false)
        .then(didOpen => {
        if (!didOpen) {
            vscode_1.window.showWarningMessage(openingFailureWarning);
        }
        return didOpen;
    });
}
function openFormatter(extensionPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const defaultFormatter = path.join(extensionPath, 'formatters', 'eclipse-formatter.xml');
        const formatterUrl = utils_1.getJavaConfiguration().get('format.settings.url');
        if (formatterUrl && formatterUrl.length > 0) {
            if (isRemote(formatterUrl)) {
                vscode_1.commands.executeCommand(commands_1.Commands.OPEN_BROWSER, vscode_1.Uri.parse(formatterUrl));
            }
            else {
                const document = getPath(formatterUrl);
                if (document && fs.existsSync(document)) {
                    return openDocument(extensionPath, document, defaultFormatter, null);
                }
            }
        }
        const global = vscode_1.workspace.workspaceFolders === undefined;
        const fileName = formatterUrl || 'eclipse-formatter.xml';
        let file;
        let relativePath;
        if (!global) {
            file = path.join(vscode_1.workspace.workspaceFolders[0].uri.fsPath, fileName);
            relativePath = fileName;
        }
        else {
            const root = path.join(extensionPath, '..', 'redhat.java');
            if (!fs.existsSync(root)) {
                fs.mkdirSync(root);
            }
            file = path.join(root, fileName);
        }
        if (!fs.existsSync(file)) {
            addFormatter(extensionPath, file, defaultFormatter, relativePath);
        }
        else {
            if (formatterUrl) {
                utils_1.getJavaConfiguration().update('format.settings.url', (relativePath !== null ? relativePath : file), global);
                openDocument(extensionPath, file, file, defaultFormatter);
            }
            else {
                addFormatter(extensionPath, file, defaultFormatter, relativePath);
            }
        }
    });
}
function getPath(f) {
    if (vscode_1.workspace.workspaceFolders && !path.isAbsolute(f)) {
        vscode_1.workspace.workspaceFolders.forEach(wf => {
            const file = path.resolve(wf.uri.path, f);
            if (fs.existsSync(file)) {
                return file;
            }
        });
    }
    else {
        return path.resolve(f);
    }
    return null;
}
function openDocument(extensionPath, formatterUrl, defaultFormatter, relativePath) {
    return vscode_1.workspace.openTextDocument(formatterUrl)
        .then(doc => {
        if (!doc) {
            addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath);
        }
        return vscode_1.window.showTextDocument(doc, vscode_1.window.activeTextEditor ?
            vscode_1.window.activeTextEditor.viewColumn : undefined)
            .then(editor => !!editor);
    }, () => false)
        .then(didOpen => {
        if (!didOpen) {
            vscode_1.window.showWarningMessage('Could not open Formatter Settings file');
            addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath);
        }
        else {
            return didOpen;
        }
    });
}
function isRemote(f) {
    return f !== null && f.startsWith('http:/') || f.startsWith('https:/');
}
function addFormatter(extensionPath, formatterUrl, defaultFormatter, relativePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = {
            value: (relativePath ? relativePath : formatterUrl),
            prompt: 'please enter URL or Path:',
            ignoreFocusOut: true
        };
        yield vscode_1.window.showInputBox(options).then(f => {
            if (f) {
                const global = vscode_1.workspace.workspaceFolders === undefined;
                if (isRemote(f)) {
                    vscode_1.commands.executeCommand(commands_1.Commands.OPEN_BROWSER, vscode_1.Uri.parse(f));
                    utils_1.getJavaConfiguration().update('format.settings.url', f, global);
                }
                else {
                    if (!path.isAbsolute(f)) {
                        const fileName = f;
                        if (!global) {
                            f = path.join(vscode_1.workspace.workspaceFolders[0].uri.fsPath, fileName);
                            relativePath = fileName;
                        }
                        else {
                            const root = path.join(extensionPath, '..', 'redhat.java');
                            if (!fs.existsSync(root)) {
                                fs.mkdirSync(root);
                            }
                            f = path.join(root, fileName);
                        }
                    }
                    else {
                        relativePath = null;
                    }
                    utils_1.getJavaConfiguration().update('format.settings.url', (relativePath !== null ? relativePath : f), global);
                    if (!fs.existsSync(f)) {
                        const name = relativePath !== null ? relativePath : f;
                        const msg = `' ${name} ' does not exist. Do you want to create it?`;
                        const action = 'Yes';
                        vscode_1.window.showWarningMessage(msg, action, 'No').then((selection) => {
                            if (action === selection) {
                                fs.createReadStream(defaultFormatter)
                                    .pipe(fs.createWriteStream(f))
                                    .on('finish', () => openDocument(extensionPath, f, defaultFormatter, relativePath));
                            }
                        });
                    }
                    else {
                        openDocument(extensionPath, f, defaultFormatter, relativePath);
                    }
                }
            }
        });
    });
}
function applyWorkspaceEdit(obj, languageClient) {
    return __awaiter(this, void 0, void 0, function* () {
        const edit = languageClient.protocol2CodeConverter.asWorkspaceEdit(obj);
        if (edit) {
            yield vscode_1.workspace.applyEdit(edit);
            // By executing the range formatting command to correct the indention according to the VS Code editor settings.
            // More details, see: https://github.com/redhat-developer/vscode-java/issues/557
            try {
                const currentEditor = vscode_1.window.activeTextEditor;
                // If the Uri path of the edit change is not equal to that of the active editor, we will skip the range formatting
                if (currentEditor.document.uri.fsPath !== edit.entries()[0][0].fsPath) {
                    return;
                }
                const cursorPostion = currentEditor.selection.active;
                // Get the array of all the changes
                const changes = edit.entries()[0][1];
                // Get the position information of the first change
                let startPosition = new vscode_1.Position(changes[0].range.start.line, changes[0].range.start.character);
                let lineOffsets = changes[0].newText.split(/\r?\n/).length - 1;
                for (let i = 1; i < changes.length; i++) {
                    // When it comes to a discontinuous range, execute the range formatting and record the new start position
                    if (changes[i].range.start.line !== startPosition.line) {
                        yield executeRangeFormat(currentEditor, startPosition, lineOffsets);
                        startPosition = new vscode_1.Position(changes[i].range.start.line, changes[i].range.start.character);
                        lineOffsets = 0;
                    }
                    lineOffsets += changes[i].newText.split(/\r?\n/).length - 1;
                }
                yield executeRangeFormat(currentEditor, startPosition, lineOffsets);
                // Recover the cursor's original position
                currentEditor.selection = new vscode_1.Selection(cursorPostion, cursorPostion);
            }
            catch (error) {
                languageClient.error(error);
            }
        }
    });
}
exports.applyWorkspaceEdit = applyWorkspaceEdit;
function executeRangeFormat(editor, startPosition, lineOffset) {
    return __awaiter(this, void 0, void 0, function* () {
        const endPosition = editor.document.positionAt(editor.document.offsetAt(new vscode_1.Position(startPosition.line + lineOffset + 1, 0)) - 1);
        editor.selection = new vscode_1.Selection(startPosition, endPosition);
        yield vscode_1.commands.executeCommand('editor.action.formatSelection');
    });
}
function getTriggerFiles() {
    const openedJavaFiles = [];
    const activeJavaFile = getJavaFilePathOfTextEditor(vscode_1.window.activeTextEditor);
    if (activeJavaFile) {
        openedJavaFiles.push(vscode_1.Uri.file(activeJavaFile).toString());
    }
    if (!vscode_1.workspace.workspaceFolders) {
        return openedJavaFiles;
    }
    for (const rootFolder of vscode_1.workspace.workspaceFolders) {
        if (rootFolder.uri.scheme !== 'file') {
            continue;
        }
        const rootPath = path.normalize(rootFolder.uri.fsPath);
        if (isPrefix(rootPath, activeJavaFile)) {
            continue;
        }
        for (const textEditor of vscode_1.window.visibleTextEditors) {
            const javaFileInTextEditor = getJavaFilePathOfTextEditor(textEditor);
            if (isPrefix(rootPath, javaFileInTextEditor)) {
                openedJavaFiles.push(vscode_1.Uri.file(javaFileInTextEditor).toString());
                break;
            }
        }
    }
    return openedJavaFiles;
}
function getJavaFilePathOfTextEditor(editor) {
    if (editor) {
        const resource = editor.document.uri;
        if (resource.scheme === 'file' && resource.fsPath.endsWith('.java')) {
            return path.normalize(resource.fsPath);
        }
    }
    return undefined;
}
function isPrefix(parentPath, childPath) {
    if (!childPath) {
        return false;
    }
    const relative = path.relative(parentPath, childPath);
    return !!relative && !relative.startsWith('..') && !path.isAbsolute(relative);
}
//# sourceMappingURL=extension.js.map
