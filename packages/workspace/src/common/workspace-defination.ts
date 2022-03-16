import Ajv from 'ajv';

import { StorageService } from '@opensumi/ide-core-browser/lib/services';
import { URI, Event } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

export const DEFAULT_WORKSPACE_SUFFIX_NAME = 'sumi-workspace';
export const WORKSPACE_USER_STORAGE_FOLDER_NAME = '.sumi';
export const WORKSPACE_RECENT_DATA_FILE = 'recentdata.json';
export const UNTITLED_WORKSPACE = 'Untitled';

export interface WorkspaceInput {
  /**
   * 判断是否复用相同窗口
   */
  preserveWindow?: boolean;
}

export interface WorkspaceData {
  folders: Array<{ path: string; name?: string }>;
  settings?: { [id: string]: any };
}

export namespace WorkspaceData {
  const validateSchema = new Ajv().compile({
    type: 'object',
    properties: {
      folders: {
        description: 'Root folders in the workspace',
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
            },
          },
          required: ['path'],
        },
      },
      settings: {
        description: 'Workspace preferences',
        type: 'object',
      },
    },
    required: ['folders'],
  });

  export function is(data: any): data is WorkspaceData {
    return !!validateSchema(data);
  }

  export function buildWorkspaceData(
    folders: string[] | FileStat[],
    settings: { [id: string]: any } | undefined,
  ): WorkspaceData {
    let roots: string[] = [];
    if (folders.length > 0) {
      if (typeof folders[0] !== 'string') {
        roots = (folders as FileStat[]).map((folder) => folder.uri);
      } else {
        roots = folders as string[];
      }
    }
    const data: WorkspaceData = {
      folders: roots.map((folder) => ({ path: folder })),
    };
    if (settings) {
      data.settings = settings;
    }
    return data;
  }

  /**
   * 存储时需要将 {workspace}.sumi-workspace 内容存储为相对路径存储
   * 1. 如果可用相对路径表示，则存储为:
   * {
   *  "folders": [
   *    {
   *       "path": "folder1"
   *     },
   *     {
   *       "path": "folder2"
   *     }
   *   ],
   * }
   *
   * 2. 如果不可用相对路径表示，则存储绝对路径：
   * {
   *  "folders": [
   *    {
   *       "path": "file://abc/folder1"
   *     },
   *     {
   *       "path": "file://cdf/folder2"
   *     }
   *   ],
   * }
   *
   * @export
   * @param {WorkspaceData} data
   * @param {FileStat} [workspaceFile]
   * @returns {WorkspaceData}
   */
  export function transformToRelative(data: WorkspaceData, workspaceFile?: FileStat): WorkspaceData {
    const folderUris: string[] = [];
    const workspaceFileUri = new URI(workspaceFile ? workspaceFile.uri : '').withScheme('file');
    for (const { path } of data.folders) {
      const folderUri = new URI(path).withScheme('file');
      if (workspaceFileUri.parent.isEqualOrParent(folderUri)) {
        if (workspaceFileUri.parent.isEqual(folderUri)) {
          folderUris.push('.');
        } else {
          const rel = workspaceFileUri.parent.relative(folderUri);
          folderUris.push(rel!.toString() || '.');
        }
      } else {
        folderUris.push(folderUri.toString());
      }
    }
    return buildWorkspaceData(folderUris, data.settings);
  }

  /**
   * 将 {workspace}.sumi-workspace 中存储的相对路径转换为绝对路径
   *
   * @export
   * @param {WorkspaceData} data
   * @param {FileStat} [workspaceFile]
   * @returns {WorkspaceData}
   */
  export function transformToAbsolute(data: WorkspaceData, workspaceFile?: FileStat): WorkspaceData {
    if (workspaceFile) {
      const folders: string[] = [];
      for (const folder of data.folders) {
        const path = folder.path;
        // 判断是否为绝对路径
        if (/^.+:\//.test(path)) {
          folders.push(path);
        } else {
          if (path === '.') {
            folders.push(new URI(workspaceFile.uri).parent.toString());
          } else {
            folders.push(new URI(workspaceFile.uri).parent.resolve(path).toString());
          }
        }
      }
      return Object.assign(data, buildWorkspaceData(folders, data.settings));
    }
    return data;
  }
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
