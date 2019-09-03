import { Command } from '@ali/ide-core-common';

export const WorkspaceServerPath = 'WorkspaceService';

export const IWorkspaceServer = Symbol('WorkspaceServer');
/**
 * JSON-RPC workspace 接口.
 */
export interface IWorkspaceServer {

  /**
   * 返回最近打开的工作区，仅一个
   * @returns {(Promise<string | undefined>)}
   * @memberof WorkspaceServer
   */
  getMostRecentlyUsedWorkspace(): Promise<string | undefined>;

  /**
   * 设置最近打开的工作区
   * @param {string} uri
   * @returns {Promise<void>}
   * @memberof WorkspaceServer
   */
  setMostRecentlyUsedWorkspace(uri: string): Promise<void>;

  /**
   * 返回最近打开的工作区列表
   * @returns {Promise<string[]>}
   * @memberof WorkspaceServer
   */
  getRecentWorkspacePaths(): Promise<string[]>;

  /**
   * 设置最近使用的命令
   * @param {Command} command
   * @returns {Promise<void>}
   * @memberof WorkspaceServer
   */
  setMostRecentlyUsedCommand(command: Command): Promise<void>;

  /**
   * 返回最近使用的命令列表
   * @returns {Promise<Command[]>}
   * @memberof WorkspaceServer
   */
  getRecentCommands(): Promise<Command[]>;

  /**
   * 添加最近打开文件
   * @param uri
   */
  setMostRecentlyOpenedFile(uri: string): Promise<void>;

  /**
   * 获取最近打开文件列表
   */
  getMostRecentlyOpenedFiles(): Promise<string[] | undefined>;
}
