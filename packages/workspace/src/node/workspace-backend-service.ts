import * as path from 'path';
import * as yargs from 'yargs';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as jsoncparser from 'jsonc-parser';

import { Injectable } from '@ali/common-di';
import { IWorkspaceServer, WORKSPACE_USER_STORAGE_FOLDER_NAME, WORKSPACE_RECENT_DATA_FILE } from '../common';
import { Command, Deferred, FileUri, isArray } from '@ali/ide-core-common';

@Injectable()
export class WorkspaceBackendServer implements IWorkspaceServer {

  protected root: Deferred<any> = new Deferred();
  protected command: Deferred<any> = new Deferred();

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
      const data = await this.readRecentDataFromUserHome();
      if (data && data.recentRoots) {
        root = data.recentRoots[0];
      }
    }
    return root;
  }

  getMostRecentlyUsedWorkspace(): Promise<string | undefined> {
    return this.root.promise;
  }

  getMostRecentlyUsedCommand(): Promise<string | undefined> {
    return this.command.promise;
  }

  async setMostRecentlyUsedWorkspace(uri: string): Promise<void> {
    this.root = new Deferred();
    const listUri: string[] = [];
    const oldListUri = await this.getRecentWorkspacePaths();
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

  async setMostRecentlyUsedCommand(command: Command): Promise<void> {
    this.command = new Deferred<Command>();
    let listCommand: Command[] = [];
    const oldListCommand = await this.getRecentCommands();
    listCommand.push(command);
    if (oldListCommand) {
      oldListCommand.forEach((element: Command) => {
        if (element.id !== command.id) {
          listCommand.push(element);
        }
      });
    }
    // 仅存储10个最近命令
    listCommand = listCommand.slice(0, 50);
    this.root.resolve(command);
    this.writeToUserHome({
      recentCommands: listCommand,
    });
  }

  async getRecentWorkspacePaths(): Promise<string[]> {
    const listUri: string[] = [];
    const data = await this.readRecentDataFromUserHome();
    // 判断工作区路径是否存在，不存在则移除
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

  async getRecentCommands(): Promise<Command[]> {
    const data = await this.readRecentDataFromUserHome();
    return data && data.recentCommands || [];
  }

  async setMostRecentlyOpenedFile(uri: string): Promise<void> {
    let fileList: string[] = [];
    const oldFileList = await this.getMostRecentlyOpenedFiles();
    fileList.push(uri);
    if (oldFileList) {
      oldFileList.forEach((element: string) => {
        if (element !== uri) {
          fileList.push(element);
        }
      });
    }
    // 仅存储50个最近文件
    fileList = fileList.slice(0, 50);
    this.writeToUserHome({
      recentFiles: fileList,
    });
  }

  async getMostRecentlySearchWord(): Promise<string[] | undefined> {
    const data = await this.readRecentDataFromUserHome();
    return data && data.recentSearchWord || [];
  }

  async setMostRecentlySearchWord(word: string | string[]): Promise<void> {
    let list: string[] = [];
    const oldList = await this.getMostRecentlySearchWord() || [];
    if (isArray(word)) {
      list = list.concat(word);
    } else {
      list.push(word);
    }

    list = oldList.concat(list);
    list = Array.from(new Set(list));
    // 仅存储10个
    list = list.slice(0, 10);
    this.writeToUserHome({
      recentSearchWord: list,
    });
  }

  async getMostRecentlyOpenedFiles(): Promise<string[] | undefined> {
    const data = await this.readRecentDataFromUserHome();
    return data && data.recentFiles || [];
  }

  protected workspaceStillExist(wspath: string): boolean {
    return fs.pathExistsSync(FileUri.fsPath(wspath));
  }

  /**
   * 写入最近使用的工作区路径数据
   * @param uri
   */
  protected async writeToUserHome(data: RecentWorkspaceData): Promise<void> {
    const file = this.getUserStoragePath();
    const rawData = await this.readRecentDataFromUserHome();
    await this.writeToFile(file, {
      ...rawData,
      ...data,
    });
  }

  protected async writeToFile(filePath: string, data: object): Promise<void> {
    if (!await fs.pathExists(filePath)) {
      await fs.mkdirs(path.resolve(filePath, '..'));
    }
    await fs.writeJson(filePath, data);
  }

  /**
   * 从用户目录读取最近的工作区数据
   */
  protected async readRecentDataFromUserHome(): Promise<RecentWorkspaceData | undefined> {
    const filePath = this.getUserStoragePath();
    const data = await this.readJsonFromFile(filePath);
    return data;
  }

  protected async readJsonFromFile(filePath: string): Promise<object | undefined> {
    if (await fs.pathExists(filePath)) {
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const strippedContent = jsoncparser.stripComments(rawContent);
      return jsoncparser.parse(strippedContent);
    }
  }

  protected getUserStoragePath(): string {
    return path.resolve(os.homedir(), WORKSPACE_USER_STORAGE_FOLDER_NAME, WORKSPACE_RECENT_DATA_FILE);
  }
}

interface RecentWorkspaceData {
  recentRoots?: string[];
  recentCommands?: Command[];
  recentFiles?: string[];
  recentSearchWord?: string[];
}
