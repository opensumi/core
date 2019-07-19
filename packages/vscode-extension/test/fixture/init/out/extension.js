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
const testSelector = 'javascript';
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "init" is now active!');
    // The code you place here will be executed every time your command is executed
    console.log('hello world from ext-host');
    // vscode.window.showInformationMessage('info');
    vscode.window.showErrorMessage('error', {
        modal: true
    });
    // 插件执行主进程命令
    // vscode.commands.executeCommand('core.about');
    // Display a message box to the user
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
    const disposableMessage = vscode.commands.registerCommand('extension.showInformationMessage', () => {
        vscode.window.showInformationMessage('info');
    });
    const disposableMessageModal = vscode.commands.registerCommand('extension.showErrorMessageModal', () => {
        vscode.window.showErrorMessage('error', {
            modal: true
        });
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

    vscode.languages.registerHoverProvider(testSelector, {
        provideHover(document, position, token) {
            console.log('hover');
            return new vscode.Hover('I am a hover!');
        },
    });
    vscode.languages.registerCompletionItemProvider(testSelector, {
        provideCompletionItems(document, position, token, context) {
            // a simple completion item which inserts `Hello World!`
            const simpleCompletion = new vscode.CompletionItem('Hello World!');
            // a completion item that inserts its text as snippet,
            // the `insertText`-property is a `SnippetString` which we will
            // honored by the editor.
            // TODO 还未实现
            const snippetCompletion = new vscode.CompletionItem('Good part of the day');
            snippetCompletion.insertText = new vscode.SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?');
            snippetCompletion.documentation = new vscode.MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.");
            // a completion item that can be accepted by a commit character,
            // the `commitCharacters`-property is set which means that the completion will
            // be inserted and then the character will be typed.
            // TODO 还未实现
            const commitCharacterCompletion = new vscode.CompletionItem('console');
            commitCharacterCompletion.commitCharacters = ['.'];
            commitCharacterCompletion.documentation = new vscode.MarkdownString('Press `.` to get `console.`');
            // a completion item that retriggers IntelliSense when being accepted,
            // the `command`-property is set which the editor will execute after 
            // completion has been inserted. Also, the `insertText` is set so that 
            // a space is inserted after `new`
            const commandCompletion = new vscode.CompletionItem('new');
            commandCompletion.kind = vscode.CompletionItemKind.Keyword;
            commandCompletion.insertText = 'new ';
            commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };
            // return all completion items as array
            return [
                {
                    label: 'getIniDouble',
                    kind: 2,
                    insertText: 'getIniDouble(${1:sec}, ${2: key})',
                    // insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    documentation: '从ini类型的数据中，根据section和key，获取key对应的值，作为浮点数返回'
                },
                simpleCompletion,
                snippetCompletion,
                commitCharacterCompletion,
                commandCompletion
            ];
        }
    }, '.');
    const testStartPos = new vscode.Position(1, 1);
    const testEndPos = new vscode.Position(2, 1);
    const testRange = new vscode.Range(testStartPos, testEndPos);
    vscode.languages.registerDefinitionProvider(testSelector, {
        provideDefinition: (document, position, token) => {
            let new_position = new vscode.Position(position.line + 1, position.character);
            let newUri = vscode.Uri.parse(document.uri.toString().replace(/\d/, '6'));
            return new vscode.Location(newUri, new_position);
        }
    });
    vscode.languages.registerTypeDefinitionProvider(testSelector, {
        provideTypeDefinition: (document, position) => {
            let new_position = new vscode.Position(position.line + 2, position.character + 2);
            let newUri = vscode.Uri.parse(document.uri.toString().replace(/\d/, '1'));
            return new vscode.Location(newUri, new_position);
        }
    });
    vscode.languages.registerColorProvider(testSelector, {
        provideColorPresentations: (color, context, token) => {
            return [
                {
                    label: "color picker title text"
                }
            ];
        },
        provideDocumentColors: (doc, token) => {
            return [
                {
                    color: new vscode.Color(255, 0, 0, 0.5),
                    range: testRange,
                },
            ];
        }
    });
    vscode.languages.registerFoldingRangeProvider(testSelector, {
        provideFoldingRanges: (doc, context, token) => {
            return [new vscode.FoldingRange(0, 2, vscode.FoldingRangeKind.Comment)];
        }
    });
    vscode.languages.registerDocumentHighlightProvider(testSelector, {
        provideDocumentHighlights: (doc, pos, token) => {
            return [new vscode.DocumentHighlight(testRange, vscode.DocumentHighlightKind.Write)];
        }
    });
    // vscode.languages.registerSelectionRangeProvider(testSelector, {
    // provideSelectionRanges: (doc, postions, token) => {
    // return new vscode.SelectionRange(new vscode.Range())
    // }
    // });
    // context.subscriptions.push(disposable);
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
