/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { PluginManager } from './utils/plugins';
import * as Proto from "src/protocol";

class ApiV0 {
	public constructor(
		public readonly onCompletionAccepted: vscode.Event<vscode.CompletionItem & { metadata?: any }>,
		private readonly _pluginManager: PluginManager,
	) { }

	configurePlugin(pluginId: string, configuration: {}): void {
		this._pluginManager.setConfiguration(pluginId, configuration);
	}
}

export interface Api {
	getAPI(version: 0): ApiV0 | undefined;
}

export function getExtensionApi(
	onCompletionAccepted: vscode.Event<vscode.CompletionItem>,
	pluginManager: PluginManager,
): Api {
	return {
		getAPI(version) {
			if (version === 0) {
				return new ApiV0(onCompletionAccepted, pluginManager);
			}
			return undefined;
		}
	};
}

export interface ITSClient{

  execute(command: string, args: any, token: vscode.CancellationToken, lowPriority?: boolean): Promise<any>;

  executeWithoutWaitingForResponse(command: string, args: any): void;

  executeAsync(command: string, args: Proto.GeterrRequestArgs, token: vscode.CancellationToken): Promise<any>;

}