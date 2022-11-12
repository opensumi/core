'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.activate = void 0;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('getting-started-sample.runCommand', async () => {
      vscode.commands.executeCommand(
        'getting-started-sample.sayHello',
        vscode.Uri.joinPath(context.extensionUri, 'sample-folder'),
      );
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('getting-started-sample.changeSetting', async () => {
      vscode.workspace.getConfiguration('getting-started-sample').update('sampleSetting', true);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('getting-started-sample.setContext', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      vscode.commands.executeCommand('setContext', 'gettingStartedContextKey', true);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('getting-started-sample.sayHello', () => {
      vscode.window.showInformationMessage('Hello');
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('getting-started-sample.viewSources', () => {
      '6666666';
      return { openFolder: vscode.Uri.joinPath(context.extensionUri, 'src') };
    }),
  );
}
exports.activate = activate;
// # sourceMappingURL=extension.js.map
