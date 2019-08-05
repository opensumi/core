"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const Client = require("ftp");
const path_1 = require("path");
class FtpModel {
    constructor(host, user, password) {
        this.host = host;
        this.user = user;
        this.password = password;
        this.nodes = new Map();
    }
    connect() {
        return new Promise((c, e) => {
            const client = new Client();
            client.on('ready', () => {
                c(client);
            });
            client.on('error', error => {
                e('Error while connecting: ' + error.message);
            });
            client.connect({
                host: this.host,
                username: this.user,
                password: this.password
            });
        });
    }
    get roots() {
        return this.connect().then(client => {
            return new Promise((c, e) => {
                client.list((err, list) => {
                    if (err) {
                        return e(err);
                    }
                    client.end();
                    return c(this.sort(list.map(entry => ({ resource: vscode.Uri.parse(`ftp://${this.host}///${entry.name}`), isDirectory: entry.type === 'd' }))));
                });
            });
        });
    }
    getChildren(node) {
        return this.connect().then(client => {
            return new Promise((c, e) => {
                client.list(node.resource.fsPath, (err, list) => {
                    if (err) {
                        return e(err);
                    }
                    client.end();
                    return c(this.sort(list.map(entry => ({ resource: vscode.Uri.parse(`${node.resource.fsPath}/${entry.name}`), isDirectory: entry.type === 'd' }))));
                });
            });
        });
    }
    sort(nodes) {
        return nodes.sort((n1, n2) => {
            if (n1.isDirectory && !n2.isDirectory) {
                return -1;
            }
            if (!n1.isDirectory && n2.isDirectory) {
                return 1;
            }
            return path_1.basename(n1.resource.fsPath).localeCompare(path_1.basename(n2.resource.fsPath));
        });
    }
    getContent(resource) {
        return this.connect().then(client => {
            return new Promise((c, e) => {
                client.get(resource.path.substr(2), (err, stream) => {
                    if (err) {
                        return e(err);
                    }
                    let string = '';
                    stream.on('data', function (buffer) {
                        if (buffer) {
                            var part = buffer.toString();
                            string += part;
                        }
                    });
                    stream.on('end', function () {
                        client.end();
                        c(string);
                    });
                });
            });
        });
    }
}
exports.FtpModel = FtpModel;
class FtpTreeDataProvider {
    constructor(model) {
        this.model = model;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return {
            resourceUri: element.resource,
            collapsibleState: element.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : void 0,
            command: element.isDirectory ? void 0 : {
                command: 'ftpExplorer.openFtpResource',
                arguments: [element.resource],
                title: 'Open FTP Resource'
            }
        };
    }
    getChildren(element) {
        return element ? this.model.getChildren(element) : this.model.roots;
    }
    getParent(element) {
        const parent = element.resource.with({ path: path_1.dirname(element.resource.path) });
        return parent.path !== '//' ? { resource: parent, isDirectory: true } : null;
    }
    provideTextDocumentContent(uri, token) {
        return this.model.getContent(uri).then(content => content);
    }
}
exports.FtpTreeDataProvider = FtpTreeDataProvider;
class FtpExplorer {
    constructor(context) {
        /* Please note that login information is hardcoded only for this example purpose and recommended not to do it in general. */
        const ftpModel = new FtpModel('mirror.switch.ch', 'anonymous', 'anonymous@anonymous.de');
        const treeDataProvider = new FtpTreeDataProvider(ftpModel);
        context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('ftp', treeDataProvider));
        this.ftpViewer = vscode.window.createTreeView('ftpExplorer', { treeDataProvider });
        vscode.commands.registerCommand('ftpExplorer.refresh', () => treeDataProvider.refresh());
        vscode.commands.registerCommand('ftpExplorer.openFtpResource', resource => this.openResource(resource));
        vscode.commands.registerCommand('ftpExplorer.revealResource', () => this.reveal());
    }
    openResource(resource) {
        vscode.window.showTextDocument(resource);
    }
    reveal() {
        const node = this.getNode();
        if (node) {
            return this.ftpViewer.reveal(node);
        }
        return null;
    }
    getNode() {
        if (vscode.window.activeTextEditor) {
            if (vscode.window.activeTextEditor.document.uri.scheme === 'ftp') {
                return { resource: vscode.window.activeTextEditor.document.uri, isDirectory: false };
            }
        }
        return null;
    }
}
exports.FtpExplorer = FtpExplorer;
//# sourceMappingURL=ftpExplorer.js.map