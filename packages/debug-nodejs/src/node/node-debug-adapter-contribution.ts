import * as path from 'path';
import { Injectable } from '@ali/common-di';
import { FileUri } from '@ali/ide-core-node';
import { DebugConfiguration } from '@ali/ide-debug';
import { AbstractVSCodeDebugAdapterContribution } from '@ali/ide-debug/lib/node/vscode/vscode-debug-adapter-contribution';
const psList: () => Promise<[{ pid: number, cmd: string }]> = require('ps-list'); // FIXME use import, provide proper d.ts file

export const INSPECTOR_PORT_DEFAULT = 9229;
export const LEGACY_PORT_DEFAULT = 5858;

@Injectable()
export class NodeDebugAdapterContribution extends AbstractVSCodeDebugAdapterContribution {
    constructor() {
        super(
            'node',
            path.join(__dirname, '../../download/node-debug/extension'),
        );
    }

    // TODO: construct based on package.json of the given workspace
    provideDebugConfigurations(workspaceFolderUri?: string): DebugConfiguration[] {
        return [{
            type: this.type,
            request: 'attach',
            name: 'Debug (Attach)',
            processId: '',
        }];
    }

    // TODO: align with vscode-node-debug
    async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri?: string): Promise<DebugConfiguration | undefined> {
        if (!config.cwd && !!workspaceFolderUri) {
            config.cwd = FileUri.fsPath(workspaceFolderUri);
        }
        if (!config.cwd) {
            config.cwd = '${workspaceFolder}';
        }
        if (config.request === 'attach' && typeof config.processId === 'string') {
            await this.resolveAttachConfiguration(config);
        }
        config.type = await this.resolveDebugType(config);
        return config;
    }

    protected async resolveDebugType(config: DebugConfiguration): Promise<string> {
        if (config.protocol === 'legacy') {
            return 'node';
        }
        if (config.protocol === 'inspector') {
            return 'node2';
        }
        // TODO: auto detect
        return 'node2';
    }

    // TODO: align with vscode-node-debug
    protected async resolveAttachConfiguration(config: DebugConfiguration): Promise<void> {
        config.protocol = 'inspector';
        config.port = 9229;

        const pidToDebug = parseInt(config.processId, 10);

        const tasks = await psList();
        const taskToDebug = tasks.find((task) => task.pid === pidToDebug);
        if (taskToDebug) {
            const matches = /--(inspect|debug)-port=(\d+)/.exec(taskToDebug.cmd);
            if (matches && matches.length === 3) {
                config.port = parseInt(matches[2], 10);
                config.protocol = matches[1] === 'debug' ? 'legacy' : 'inspector';
            }
        }

        delete config.processId;
    }
}

@Injectable()
export class Node2DebugAdapterContribution extends AbstractVSCodeDebugAdapterContribution {
    constructor() {
        super(
            'node2',
            path.join(__dirname, '../../download/node-debug2/extension'),
        );
    }
}
