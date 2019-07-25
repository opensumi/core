// tslint:disable
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { join } from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

  console.log('Congratulations ===> ', vscode.workspace.getConfiguration('application').get('confirmExit'))


  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "init" is now active!');

  console.log('vscode.workspace.rootPath ===> ', vscode.workspace.rootPath);
  console.log('vscode.workspace.workspaceFolders ===> ', vscode.workspace.workspaceFolders);
  console.log('vscode.workspace.getWorkspaceFolder ===> ', vscode.workspace.getWorkspaceFolder);

  /*

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
    // The code you place here will be executed every time your command is executed
    console.log('hello world from ext-host');
    console.log('Congratulations ===> ', vscode.workspace.getConfiguration('application').get('confirmExit'))
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
      testEditorDecoration();

  });

  let statusbar: vscode.Disposable;
  vscode.workspace.onDidChangeConfiguration((event) => {
    console.log('Configuration Change ==> ', event)
    const section = 'application.confirmExit'
    console.log(`section ${section} has change ? `, event.affectsConfiguration(section))
  })

  vscode.commands.registerCommand('extension.setStatusBar', () => {
    statusbar = vscode.window.setStatusBarMessage('set status bar success', 3 * 1000);
  });
  vscode.commands.registerCommand('extension.disposeStatusBar', () => {
    if (statusbar) {
      statusbar.dispose();
    }
  });

  const disposableMessage = vscode.commands.registerCommand('extension.showInformationMessage', async () => {
    // const selected = await vscode.window.showInformationMessage('info', { modal : true}, 'btn1', 'btn2');
    // console.log('selected');
    // console.log(selected);

    const selected = await vscode.window.showQuickPick([{
      label: '1111',
      description: '1111 description'
    }, {
      label: '2222'
    }], {
        placeHolder: '哈哈哈'
      });
    // const selected = await vscode.window.showQuickPick(['333', '444']);
    console.log('selected');
    console.log(selected);
  });

  const disposableMessageModal = vscode.commands.registerCommand('extension.showErrorMessageModal', async () => {
    const selected = await vscode.window.showErrorMessage('error', 'btn1', 'btn2');
    console.log('selected');
    console.log(selected);
  });
  vscode.languages.registerHoverProvider('javascript', {
    provideHover(document, position, token) {
      return new vscode.Hover('I am a hover!');
    },
  });

  vscode.languages.registerHoverProvider('javascript', {
    provideHover(document, position, token) {
      return new vscode.Hover('I am a hover!');
    },
  });

  vscode.workspace.onDidOpenTextDocument((doc) => {
    vscode.window.showInformationMessage(doc.uri.path);
    // console.log('from extension:\n', doc.getText());
  })
  vscode.commands.registerCommand('extension.openTextDocument', () => {
    if (vscode.workspace.rootPath) {
      vscode.workspace.openTextDocument(
        join(vscode.workspace.rootPath, 'src/index.1.js')
      );
    }
  })

  extensionApi();
  context.subscriptions.push(disposable);
  */
}

export function testEditorDecoration() {
  const type = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'red',
		isWholeLine: true,
	})
	const type2 = vscode.window.createTextEditorDecorationType({
		backgroundColor: 'yellow',
		isWholeLine: true,
	})
    let a = 0;
	let c;
	let c2;
	vscode.window.onDidChangeActiveTextEditor(() => {
		console.log('==>visibleTextEditor', vscode.window.visibleTextEditors[0].document.getText());
		const editor = vscode.window.activeTextEditor;
		a = 0;
		if (c) {
			clearInterval(c);
			clearInterval(c2);
		}
		c = setInterval(() => {
				if (editor) {
					editor.setDecorations(type, [new vscode.Range(a,0,a,1)]);
					a ++;
				}
		},1000);
		c2 = setInterval(() => {
				if (editor) {
					editor.setDecorations(type2, [new vscode.Range(a+1,0,a+1,1)]);
					a ++;
				}
		},1500)
	})
}

// this method is called when your extension is deactivated
export function deactivate() { }

export function extensionApi() {
  const ktInit = vscode.extensions.getExtension('kt.init');
  console.log('vscode.extension.getExtension', ktInit && ktInit.id);
}

export async function envApi() {
  const env = vscode.env;
  console.log('env', env);

  await env.clipboard.writeText('kt');
  console.log('env.clipboard.readText', await env.clipboard.readText())

  vscode.env.openExternal(vscode.Uri.parse('https://www.alibabagroup.com'));
  vscode.env.openExternal(vscode.Uri.parse('mailto:i@ice.gs'));
}

export function fileSystemApi() {
  const watcher = vscode.workspace.createFileSystemWatcher('**/*.{ts,js}');

  watcher.onDidChange((uri) => {
    console.log('onDidChange', uri);
  })
  watcher.onDidCreate((uri) => {
    console.log('onDidCreate', uri);
  })
  watcher.onDidDelete((uri) => {
    console.log('onDidDelete', uri);
  })
}