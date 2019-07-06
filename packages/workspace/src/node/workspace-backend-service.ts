import * as path from 'path';
import * as yargs from 'yargs';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as jsoncparser from 'jsonc-parser';

import { Injectable } from '@ali/common-di';
import { Deferred, FileUri } from '@ali/ide-core-node';
import { WorkspaceServer, WORKSPACE_USER_STORAGE_FOLDER_NAME } from '../common';

@Injectable()
export class WorkspaceBackendServer implements WorkspaceServer {

    protected root: Deferred<string | undefined> = new Deferred();

    constructor() {
      this.init();
    }

    protected async init() {
        const root = await this.getRoot();
        this.root.resolve(root);
    }

    protected async getRoot(): Promise<string | undefined> {
        let root;
        // TODO: 从CLI启动方式时获取工作区路径，如 kaitian ./
        if (!root) {
            const data = await this.readRecentWorkspacePathsFromUserHome();
            if (data && data.recentRoots) {
                root = data.recentRoots[0];
            }
        }
        return root;
    }

    getMostRecentlyUsedWorkspace(): Promise<string | undefined> {
        return this.root.promise;
    }

    async setMostRecentlyUsedWorkspace(uri: string): Promise<void> {
        this.root = new Deferred();
        const listUri: string[] = [];
        const oldListUri = await this.getRecentWorkspaces();
        listUri.push(uri);
        if (oldListUri) {
            oldListUri.forEach((element) => {
                if (element !== uri && element.length > 0) {
                    listUri.push(element);
                }
            });
        }
        this.root.resolve(uri);
        this.writeToUserHome({
            recentRoots: listUri,
        });
    }

    async getRecentWorkspaces(): Promise<string[]> {
        const listUri: string[] = [];
        const data = await this.readRecentWorkspacePathsFromUserHome();
        if (data && data.recentRoots) {
            data.recentRoots.forEach((element) => {
                if (element.length > 0) {
                    if (this.workspaceStillExist(element)) {
                        listUri.push(element);
                    }
                }
            });
        }
        return listUri;
    }

    protected workspaceStillExist(wspath: string): boolean {
        return fs.pathExistsSync(FileUri.fsPath(wspath));
    }

    /**
     * 写入最近使用的工作区路径数据
     * @param uri
     */
    protected async writeToUserHome(data: RecentWorkspacePathsData): Promise<void> {
        const file = this.getUserStoragePath();
        await this.writeToFile(file, data);
    }

    protected async writeToFile(filePath: string, data: object): Promise<void> {
        if (!await fs.pathExists(filePath)) {
            await fs.mkdirs(path.resolve(filePath, '..'));
        }
        await fs.writeJson(filePath, data);
    }

    /**
     * 从用户目录读取最近的工作区路径
     */
    protected async readRecentWorkspacePathsFromUserHome(): Promise<RecentWorkspacePathsData | undefined> {
        const filePath = this.getUserStoragePath();
        const data = await this.readJsonFromFile(filePath);
        return RecentWorkspacePathsData.is(data) ? data : undefined;
    }

    protected async readJsonFromFile(filePath: string): Promise<object | undefined> {
        if (await fs.pathExists(filePath)) {
            const rawContent = await fs.readFile(filePath, 'utf-8');
            const strippedContent = jsoncparser.stripComments(rawContent);
            return jsoncparser.parse(strippedContent);
        }
    }

    protected getUserStoragePath(): string {
        return path.resolve(os.homedir(), WORKSPACE_USER_STORAGE_FOLDER_NAME, 'recentworkspace.json');
    }
}

interface RecentWorkspacePathsData {
    recentRoots: string[];
}

namespace RecentWorkspacePathsData {
    export function is(data: any): data is RecentWorkspacePathsData {
        return !!data && typeof data === 'object' && ('recentRoots' in data) && Array.isArray((data as any).recentRoots);
    }
}
