import { URI } from '@ali/ide-core-common';
import { FileStat } from '@ali/ide-file-service';

export const KAITIAN_MUTI_WORKSPACE_EXT = 'kaitian-workspace';
export const WORKSPACE_USER_STORAGE_FOLDER_NAME = '.kaitian';
export const WORKSPACE_RECENT_DATA_FILE = 'recentdata.json';

export function getTemporaryWorkspaceFileUri(home: URI): URI {
    return home.resolve(WORKSPACE_USER_STORAGE_FOLDER_NAME).resolve(`Untitled.${KAITIAN_MUTI_WORKSPACE_EXT}`).withScheme('file');
}

export const IWorkspaceService = Symbol('IWorkspaceService');
export interface IWorkspaceService {
  containsSome(paths: string[]): Promise<boolean>;
  tryGetRoots(): FileStat[];
}
