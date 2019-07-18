// tslint:disable
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "init" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
      // The code you place here will be executed every time your command is executed
      console.log('hello world from ext-host');
      // vscode.window.showInformationMessage('info');
      vscode.window.showErrorMessage('error', {
        modal: true
      });
      // 插件执行主进程命令
      // vscode.commands.executeCommand('core.about');
      // Display a message box to the user
      // vscode.window.showInformationMessage('Hello World!');
    });

    const disposableMessage = vscode.commands.registerCommand('extension.showInformationMessage', () => {
      vscode.window.showInformationMessage('info');
    });

    const disposableMessageModal = vscode.commands.registerCommand('extension.showErrorMessageModal', () => {
      vscode.window.showErrorMessage('error', {
        modal: true
      });
    });
    vscode.languages.registerHoverProvider('javascript', {
      provideHover(document, position, token) {
          return new vscode.Hover('I am a hover!');
      },
    });
    vscode.languages.registerCompletionItemProvider('javascript', {
      provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

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
    vscode.languages.registerDefinitionProvider('javascript', {
      provideDefinition: (document, position, token) => {
        let new_position = new vscode.Position(position.line + 1, position.character)
        let newUri = vscode.Uri.parse(document.uri.toString().replace(/\d/, '6'));
        return new vscode.Location(newUri, new_position);
      }
    });
    vscode.languages.registerTypeDefinitionProvider('javascript', {
      provideTypeDefinition: (document, position) => {
        let new_position = new vscode.Position(position.line + 2, position.character + 2)
        let newUri = vscode.Uri.parse(document.uri.toString().replace(/\d/, '1'));
        return new vscode.Location(newUri, new_position);
      }
    })
  // context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
