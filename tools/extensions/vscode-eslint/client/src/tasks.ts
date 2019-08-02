/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import * as vscode from 'vscode';

import { findEslint } from './utils';

interface EslintTaskDefinition extends vscode.TaskDefinition {
}

class FolderTaskProvider {
	constructor(private _workspaceFolder: vscode.WorkspaceFolder) {
	}

	public get workspaceFolder(): vscode.WorkspaceFolder {
		return this._workspaceFolder;
	}

	public isEnabled(): boolean {
		return vscode.workspace.getConfiguration('eslint', this._workspaceFolder.uri).get('provideLintTask');
	}

	public start(): void {
	}

	public dispose(): void {
	}

	public async getTask(): Promise<vscode.Task> {
		let rootPath = this._workspaceFolder.uri.scheme === 'file' ? this._workspaceFolder.uri.fsPath : undefined;
		if (!rootPath) {
			return undefined;
		}
		try {
			let command = await findEslint(rootPath);

			let kind: EslintTaskDefinition = {
				type: "eslint"
			};

			let options: vscode.ShellExecutionOptions = { cwd: this.workspaceFolder.uri.fsPath };
			return new vscode.Task(
				kind, this.workspaceFolder,
				'lint whole folder', 'eslint', new vscode.ShellExecution(`${command} .`,
				options),
				'$eslint-stylish'
			);
		} catch (error) {
			return undefined;
		}
	}
}

export class TaskProvider {

	private taskProvider: vscode.Disposable | undefined;
	private providers: Map<string, FolderTaskProvider> = new Map();

	constructor() {
	}

	public start(): void {
		let folders = vscode.workspace.workspaceFolders;
		if (folders) {
			this.updateWorkspaceFolders(folders, []);
		}
		vscode.workspace.onDidChangeWorkspaceFolders((event) => this.updateWorkspaceFolders(event.added, event.removed));
		vscode.workspace.onDidChangeConfiguration(this.updateConfiguration, this);
	}

	public dispose(): void {
		if (this.taskProvider) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
		this.providers.clear();
	}

	private updateWorkspaceFolders(added: vscode.WorkspaceFolder[], removed: vscode.WorkspaceFolder[]): void {
		for (let remove of removed) {
			let provider = this.providers.get(remove.uri.toString());
			if (provider) {
				provider.dispose();
				this.providers.delete(remove.uri.toString());
			}
		}
		for (let add of added) {
			let provider = new FolderTaskProvider(add);
			if (provider.isEnabled()) {
				this.providers.set(add.uri.toString(), provider);
				provider.start();
			}
		}
		this.updateProvider();
	}

	private updateConfiguration(): void {
		for (let detector of this.providers.values()) {
			if (!detector.isEnabled()) {
				detector.dispose();
				this.providers.delete(detector.workspaceFolder.uri.toString());
			}
		}
		let folders = vscode.workspace.workspaceFolders;
		if (folders) {
			for (let folder of folders) {
				if (!this.providers.has(folder.uri.toString())) {
					let provider = new FolderTaskProvider(folder);
					if (provider.isEnabled()) {
						this.providers.set(folder.uri.toString(), provider);
						provider.start();
					}
				}
			}
		}
		this.updateProvider();
	}

	private updateProvider(): void {
		if (!this.taskProvider && this.providers.size > 0) {
			this.taskProvider = vscode.workspace.registerTaskProvider('eslint', {
				provideTasks: () => {
					return this.getTasks();
				},
				resolveTask(_task: vscode.Task): vscode.Task | undefined {
					return undefined;
				}
			});
		}
		else if (this.taskProvider && this.providers.size === 0) {
			this.taskProvider.dispose();
			this.taskProvider = undefined;
		}
	}

	private getTasks(): Promise<vscode.Task[]> {
		if (this.providers.size === 0) {
			return Promise.resolve([]);
		} else {
			let promises: Promise<vscode.Task>[] = [];
			for (let provider of this.providers.values()) {
				promises.push(provider.getTask());
			}
			return Promise.all(promises).then((values) => {
				return values.filter(value => !!value);
			});
		}
	}
}
