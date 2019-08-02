import { URI } from '@ali/ide-core-common';

export const KAITIAN_MUTI_WORKSPACE_EXT = 'kaitian-workspace';
export const WORKSPACE_USER_STORAGE_FOLDER_NAME = '.kaitian';
export const WORKSPACE_RECENT_DATA_FILE = 'recentdata.json';

export function getTemporaryWorkspaceFileUri(home: URI): URI {
    return home.resolve(WORKSPACE_USER_STORAGE_FOLDER_NAME).resolve(`Untitled.${KAITIAN_MUTI_WORKSPACE_EXT}`).withScheme('file');
}
