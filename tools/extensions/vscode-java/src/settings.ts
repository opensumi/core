'use strict';

import { window, Uri, workspace, WorkspaceConfiguration, commands, ConfigurationTarget } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { Commands } from './commands';
import { getJavaConfiguration } from './utils';

const DEFAULT_HIDDEN_FILES: string[] = ['**/.classpath', '**/.project', '**/.settings', '**/.factorypath'];

const changeItem = {
	global: 'Exclude globally',
	workspace: 'Exclude in workspace',
	never: 'Never'
};

const EXCLUDE_FILE_CONFIG = 'configuration.checkProjectSettingsExclusions';

let oldConfig: WorkspaceConfiguration = getJavaConfiguration();

export function onConfigurationChange() {
	return workspace.onDidChangeConfiguration(params => {
		if (!params.affectsConfiguration('java')) {
			return;
		}
		const newConfig = getJavaConfiguration();
		if (newConfig.get(EXCLUDE_FILE_CONFIG)) {
			excludeProjectSettingsFiles();
		}
		if (hasJavaConfigChanged(oldConfig, newConfig)) {
			const msg = 'Java Language Server configuration changed, please restart VS Code.';
			const action = 'Restart Now';
			const restartId = Commands.RELOAD_WINDOW;
			oldConfig = newConfig;
			window.showWarningMessage(msg, action).then((selection) => {
				if (action === selection) {
					commands.executeCommand(restartId);
				}
			});
		}
	});
}

export function excludeProjectSettingsFiles() {
	if (workspace.workspaceFolders && workspace.workspaceFolders.length) {
		workspace.workspaceFolders.forEach((folder) => {
			excludeProjectSettingsFilesForWorkspace(folder.uri);
		});
	}
}

function excludeProjectSettingsFilesForWorkspace(workspaceUri: Uri) {
	const excudedConfig = getJavaConfiguration().get(EXCLUDE_FILE_CONFIG);
	if (excudedConfig) {
		const config = workspace.getConfiguration('files', workspaceUri);
		const excludedValue: Object = config.get('exclude');
		const needExcludeFiles: string[] = [];

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

			window.showInformationMessage('Do you want to exclude the VS Code Java project settings files (.classpath, .project. .settings, .factorypath) from the file explorer?', ...items).then((result) => {
				if (result === changeItem.global) {
					excludedInspectedValue.globalValue = excludedInspectedValue.globalValue || {};
					for (const hiddenFile of needExcludeFiles) {
						excludedInspectedValue.globalValue[hiddenFile] = true;
					}
					config.update('exclude', excludedInspectedValue.globalValue, ConfigurationTarget.Global);
				} if (result === changeItem.workspace) {
					excludedInspectedValue.workspaceValue = excludedInspectedValue.workspaceValue || {};
					for (const hiddenFile of needExcludeFiles) {
						excludedInspectedValue.workspaceValue[hiddenFile] = true;
					}
					config.update('exclude', excludedInspectedValue.workspaceValue, ConfigurationTarget.Workspace);
				} else if (result === changeItem.never) {
					const storeInWorkspace = getJavaConfiguration().inspect(EXCLUDE_FILE_CONFIG).workspaceValue;
					getJavaConfiguration().update(EXCLUDE_FILE_CONFIG, false, storeInWorkspace?ConfigurationTarget.Workspace: ConfigurationTarget.Global);
				}
			});
		}
	}
}

function hasJavaConfigChanged(oldConfig: WorkspaceConfiguration, newConfig: WorkspaceConfiguration) {
	return hasConfigKeyChanged('home', oldConfig, newConfig)
		|| hasConfigKeyChanged('jdt.ls.vmargs', oldConfig, newConfig)
		|| hasConfigKeyChanged('progressReports.enabled', oldConfig, newConfig);
}

function hasConfigKeyChanged(key, oldConfig, newConfig) {
	return oldConfig.get(key) !== newConfig.get(key);
}

export function getJavaEncoding(): string {
	const config = workspace.getConfiguration();
	const languageConfig = config.get('[java]');
	let javaEncoding = null;
	if (languageConfig) {
		javaEncoding = languageConfig['files.encoding'];
	}
	if (!javaEncoding) {
		javaEncoding = config.get<string>('files.encoding', 'UTF-8');
	}
	return javaEncoding;
}
