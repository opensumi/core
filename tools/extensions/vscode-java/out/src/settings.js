'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_1 = require("vscode");
const commands_1 = require("./commands");
const utils_1 = require("./utils");
const DEFAULT_HIDDEN_FILES = ['**/.classpath', '**/.project', '**/.settings', '**/.factorypath'];
const changeItem = {
    global: 'Exclude globally',
    workspace: 'Exclude in workspace',
    never: 'Never'
};
const EXCLUDE_FILE_CONFIG = 'configuration.checkProjectSettingsExclusions';
let oldConfig = utils_1.getJavaConfiguration();
function onConfigurationChange() {
    return vscode_1.workspace.onDidChangeConfiguration(params => {
        if (!params.affectsConfiguration('java')) {
            return;
        }
        const newConfig = utils_1.getJavaConfiguration();
        if (newConfig.get(EXCLUDE_FILE_CONFIG)) {
            excludeProjectSettingsFiles();
        }
        if (hasJavaConfigChanged(oldConfig, newConfig)) {
            const msg = 'Java Language Server configuration changed, please restart VS Code.';
            const action = 'Restart Now';
            const restartId = commands_1.Commands.RELOAD_WINDOW;
            oldConfig = newConfig;
            vscode_1.window.showWarningMessage(msg, action).then((selection) => {
                if (action === selection) {
                    vscode_1.commands.executeCommand(restartId);
                }
            });
        }
    });
}
exports.onConfigurationChange = onConfigurationChange;
function excludeProjectSettingsFiles() {
    if (vscode_1.workspace.workspaceFolders && vscode_1.workspace.workspaceFolders.length) {
        vscode_1.workspace.workspaceFolders.forEach((folder) => {
            excludeProjectSettingsFilesForWorkspace(folder.uri);
        });
    }
}
exports.excludeProjectSettingsFiles = excludeProjectSettingsFiles;
function excludeProjectSettingsFilesForWorkspace(workspaceUri) {
    const excudedConfig = utils_1.getJavaConfiguration().get(EXCLUDE_FILE_CONFIG);
    if (excudedConfig) {
        const config = vscode_1.workspace.getConfiguration('files', workspaceUri);
        const excludedValue = config.get('exclude');
        const needExcludeFiles = [];
        let needUpdate = false;
        for (const hiddenFile of DEFAULT_HIDDEN_FILES) {
            if (!excludedValue.hasOwnProperty(hiddenFile)) {
                needExcludeFiles.push(hiddenFile);
                needUpdate = true;
            }
        }
        if (needUpdate) {
            const excludedInspectedValue = config.inspect('exclude');
            const items = [changeItem.workspace, changeItem.never];
            // Workspace file.exclude is undefined
            if (!excludedInspectedValue.workspaceValue) {
                items.unshift(changeItem.global);
            }
            vscode_1.window.showInformationMessage('Do you want to exclude the VS Code Java project settings files (.classpath, .project. .settings, .factorypath) from the file explorer?', ...items).then((result) => {
                if (result === changeItem.global) {
                    excludedInspectedValue.globalValue = excludedInspectedValue.globalValue || {};
                    for (const hiddenFile of needExcludeFiles) {
                        excludedInspectedValue.globalValue[hiddenFile] = true;
                    }
                    config.update('exclude', excludedInspectedValue.globalValue, vscode_1.ConfigurationTarget.Global);
                }
                if (result === changeItem.workspace) {
                    excludedInspectedValue.workspaceValue = excludedInspectedValue.workspaceValue || {};
                    for (const hiddenFile of needExcludeFiles) {
                        excludedInspectedValue.workspaceValue[hiddenFile] = true;
                    }
                    config.update('exclude', excludedInspectedValue.workspaceValue, vscode_1.ConfigurationTarget.Workspace);
                }
                else if (result === changeItem.never) {
                    const storeInWorkspace = utils_1.getJavaConfiguration().inspect(EXCLUDE_FILE_CONFIG).workspaceValue;
                    utils_1.getJavaConfiguration().update(EXCLUDE_FILE_CONFIG, false, storeInWorkspace ? vscode_1.ConfigurationTarget.Workspace : vscode_1.ConfigurationTarget.Global);
                }
            });
        }
    }
}
function hasJavaConfigChanged(oldConfig, newConfig) {
    return hasConfigKeyChanged('home', oldConfig, newConfig)
        || hasConfigKeyChanged('jdt.ls.vmargs', oldConfig, newConfig)
        || hasConfigKeyChanged('progressReports.enabled', oldConfig, newConfig);
}
function hasConfigKeyChanged(key, oldConfig, newConfig) {
    return oldConfig.get(key) !== newConfig.get(key);
}
function getJavaEncoding() {
    const config = vscode_1.workspace.getConfiguration();
    const languageConfig = config.get('[java]');
    let javaEncoding = null;
    if (languageConfig) {
        javaEncoding = languageConfig['files.encoding'];
    }
    if (!javaEncoding) {
        javaEncoding = config.get('files.encoding', 'UTF-8');
    }
    return javaEncoding;
}
exports.getJavaEncoding = getJavaEncoding;
//# sourceMappingURL=settings.js.map