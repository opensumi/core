const vscode = require('vscode');

function activate(context) {
  const provider = vscode.languages.registerDefinitionProvider(
    {
      language: 'typescript',
      scheme: 'file',
      pattern: '**/reference.ts',
    },
    {
      provideDefinition(document, position) {
        if (!document.fileName.endsWith('reference.ts') || position.line !== 3) {
          return undefined;
        }

        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        if (!workspaceFolder) {
          return undefined;
        }

        return new vscode.Location(
          vscode.Uri.joinPath(workspaceFolder.uri, 'definition.ts'),
          new vscode.Range(new vscode.Position(0, 13), new vscode.Position(0, 23)),
        );
      },
    },
  );

  context.subscriptions.push(provider);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
