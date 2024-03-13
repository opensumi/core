import { Schemes, URI } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

export interface WorkspaceData {
  folders: Array<{ path: string; name?: string }>;
  settings?: { [id: string]: any };
}

const workspaceSchema = {
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
};

export namespace WorkspaceData {
  let validateSchema;

  export function is(data: any): data is WorkspaceData {
    if (!validateSchema) {
      // 避免一开始就加载 ajv，初始化和 compile 都会花费大量的时间进行编译
      const Ajv = require('ajv');
      validateSchema = new Ajv().compile(workspaceSchema);
    }
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
    const workspaceFileUri = new URI(workspaceFile ? workspaceFile.uri : '').withScheme(Schemes.file);
    for (const { path } of data.folders) {
      const folderUri = new URI(path).withScheme(Schemes.file);
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
