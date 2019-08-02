'use strict';

import { workspace, WorkspaceConfiguration } from 'vscode';

export function getJavaConfiguration(): WorkspaceConfiguration {
	return workspace.getConfiguration('java');
}
