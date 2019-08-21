'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const nodeDependencies_1 = require("./nodeDependencies");
const jsonOutline_1 = require("./jsonOutline");
const ftpExplorer_1 = require("./ftpExplorer");
const fileExplorer_1 = require("./fileExplorer");
const testView_1 = require("./testView");
function activate(context) {
    // Samples of `window.registerTreeDataProvider`
    const nodeDependenciesProvider = new nodeDependencies_1.DepNodeProvider(vscode.workspace.rootPath);
    vscode.window.registerTreeDataProvider('nodeDependencies', nodeDependenciesProvider);
    vscode.commands.registerCommand('nodeDependencies.refreshEntry', () => nodeDependenciesProvider.refresh());
    vscode.commands.registerCommand('extension.openPackageOnNpm', moduleName => vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(`https://www.npmjs.com/package/${moduleName}`)));
    vscode.commands.registerCommand('nodeDependencies.addEntry', () => vscode.window.showInformationMessage(`Successfully called add entry.`));
    vscode.commands.registerCommand('nodeDependencies.editEntry', (node) => vscode.window.showInformationMessage(`Successfully called edit entry on ${node.label}.`));
    vscode.commands.registerCommand('nodeDependencies.deleteEntry', (node) => vscode.window.showInformationMessage(`Successfully called delete entry on ${node.label}.`));
    // const jsonOutlineProvider = new jsonOutline_1.JsonOutlineProvider(context);
    // vscode.window.registerTreeDataProvider('jsonOutline', jsonOutlineProvider);
    // vscode.commands.registerCommand('jsonOutline.refresh', () => jsonOutlineProvider.refresh());
    // vscode.commands.registerCommand('jsonOutline.refreshNode', offset => jsonOutlineProvider.refresh(offset));
    // vscode.commands.registerCommand('jsonOutline.renameNode', offset => jsonOutlineProvider.rename(offset));
    // vscode.commands.registerCommand('extension.openJsonSelection', range => jsonOutlineProvider.select(range));
    // // Samples of `window.createView`
    // new ftpExplorer_1.FtpExplorer(context);
    // new fileExplorer_1.FileExplorer(context);
    // // Test View
    // new testView_1.TestView(context);
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map
