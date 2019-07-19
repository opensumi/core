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
// tslint:disable
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "init" is now active!');
    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
        // The code you place here will be executed every time your command is executed
        console.log('hello world from ext-host');
        console.log('Congratulations ===> ', vscode.workspace.getConfiguration('application').get('confirmExit'));
        // vscode.window.showInformationMessage('info');
        vscode.window.showErrorMessage('error', {
            modal: true
        });
        vscode.window.showInformationMessage('info');
        // vscode.window.showErrorMessage('error', {
        //   modal: true
        // });
        // 插件执行主进程命令
        // vscode.commands.executeCommand('core.about');
        // Display a message box to the user
        // vscode.window.showInformationMessage('Hello World!');
    });
    let statusbar;
    vscode.workspace.onDidChangeConfiguration((event) => {
        console.log('Configuration Change ==> ', event);
        const section = 'application.confirmExit';
        console.log(`section ${section} has change ? `, event.affectsConfiguration(section));
    });
    vscode.commands.registerCommand('extension.setStatusBar', () => {
        statusbar = vscode.window.setStatusBarMessage('set status bar success', 3 * 1000);
    });
    vscode.commands.registerCommand('extension.disposeStatusBar', () => {
        if (statusbar) {
            statusbar.dispose();
        }
    });
    const disposableMessage = vscode.commands.registerCommand('extension.showInformationMessage', () => __awaiter(this, void 0, void 0, function* () {
        const selected = yield vscode.window.showInformationMessage('info', { modal: true }, 'btn1', 'btn2');
        console.log('selected');
        console.log(selected);
    }));
    const disposableMessageModal = vscode.commands.registerCommand('extension.showErrorMessageModal', () => __awaiter(this, void 0, void 0, function* () {
        const selected = yield vscode.window.showErrorMessage('error', 'btn1', 'btn2');
        console.log('selected');
        console.log(selected);
    }));
    vscode.languages.registerHoverProvider('javascript', {
        provideHover(document, position, token) {
            return new vscode.Hover('I am a hover!');
        },
    });
    extensionApi();
    context.subscriptions.push(disposable);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
function extensionApi() {
    const ktInit = vscode.extensions.getExtension('kt.init');
    console.log('vscode.extension.getExtension', ktInit && ktInit.id);
}
exports.extensionApi = extensionApi;
//# sourceMappingURL=extension.js.map