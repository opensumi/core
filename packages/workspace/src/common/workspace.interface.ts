import { StorageService } from '@opensumi/ide-core-browser/lib/services';
import { URI, Event } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

export interface WorkspaceInput {
  /**
   * 判断是否复用相同窗口
   */
  preserveWindow?: boolean;
}

export const IWorkspaceService = Symbol('IWorkspaceService');

export interface IWorkspaceService {
  // 获取当前的根节点
  roots: Promise<FileStat[]>;
  // 获取workspace
  workspace: FileStat | undefined;
  // 当一个混合工作区打开时，返回 true
  isMultiRootWorkspaceOpened: boolean;
  whenReady: Promise<void>;
  // 返回根目录下是否存在对应相对路径文件
  containsSome(paths: string[]): Promise<boolean>;
  // 尝试获取根路径数组
  tryGetRoots(): FileStat[];
  // 工作区改变事件
  onWorkspaceChanged: Event<FileStat[]>;
  /**
   * 工作区的 files.exclude 配置发生变化
   */
  onWorkspaceFileExcludeChanged: Event<void>;
  /**
   * 操作中的工作区改变事件
   * 如：用户添加目录到当前workspace中触发
   */
  onWorkspaceLocationChanged: Event<FileStat | undefined>;
  // 获取最近使用的命令
  getMostRecentlyUsedCommands(): Promise<string[]>;
  // 设置最近使用的command
  setMostRecentlyUsedCommand(commandId: string): Promise<void>;
  // 获取最近的多个工作区
  getMostRecentlyUsedWorkspaces(): Promise<string[]>;
  // 获取最近的一个工作区
  getMostRecentlyUsedWorkspace(): Promise<string | undefined>;
  // 设置最近使用的工作区
  setMostRecentlyUsedWorkspace(uri: string): Promise<void>;
  // 操作工作区目录
  spliceRoots(
    start: number,
    deleteCount?: number,
    workspaceToName?: { [key: string]: string },
    ...rootsToAdd: URI[]
  ): Promise<URI[]>;
  // 从工作区中移除目录
  removeRoots(roots: URI[]): Promise<void>;
  // 获取相对于工作区的路径
  asRelativePath(pathOrUri: string | URI, includeWorkspaceFolder?: boolean): Promise<string | undefined>;
  // 根据给定的uri获取其根节点
  getWorkspaceRootUri(uri: URI | undefined): URI | undefined;
  // 获取工作区名称
  getWorkspaceName(uri: URI): string;
  // 当前存在打开的工作区同时支持混合工作区时，返回true
  isMultiRootWorkspaceEnabled: boolean;
  // 设置新的工作区
  setWorkspace(workspaceStat: FileStat | undefined): Promise<void>;
  // 初始化文件服务中 `files.exclude` 和 `watche.exclude` 配置
  initFileServiceExclude(): Promise<void>;
}

export const IWorkspaceStorageService = Symbol('IWorkspaceStorageService');

export type IWorkspaceStorageService = StorageService;
