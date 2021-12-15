import { URI, FileStat } from '@opensumi/ide-core-browser';
import { DEFAULT_WORKSPACE_SUFFIX_NAME, WorkspaceData } from '@opensumi/ide-workspace';

describe('WorkspaceData methods', () => {
  it('is method should be work', () => {
    const workspaceData = {
      folders: [
        {
          path: 'folder1',
        },
      ],
      settings: {},
    };
    expect(WorkspaceData.is(workspaceData)).toBeTruthy();
    const unknownData = {
      test: [],
    };
    expect(WorkspaceData.is(unknownData)).toBeFalsy();
  });

  it('buildWorkspaceData method should be work', () => {
    const folders = [URI.file('home').toString()];
    const settings = {
      hello: 'world',
    };
    let workspaceData = WorkspaceData.buildWorkspaceData(folders, settings);

    expect(workspaceData.folders[0].path).toBe(URI.file('home').toString());
    expect(workspaceData.settings!['hello']).toBe('world');
    const statFolders = [
      {
        uri: URI.file('home').toString(),
        isDirectory: true,
        lastModification: new Date().getTime(),
      } as FileStat,
    ];
    workspaceData = WorkspaceData.buildWorkspaceData(statFolders, settings);

    expect(workspaceData.folders[0].path).toBe(URI.file('home').toString());
    expect(workspaceData.settings!['hello']).toBe('world');
  });

  it('transformToRelative method should be work', () => {
    const workspaceFile = {
      uri: URI.file('home').resolve(`workspace.${DEFAULT_WORKSPACE_SUFFIX_NAME}`).toString(),
      isDirectory: false,
      lastModification: new Date().getTime(),
    };
    const workspaceData = {
      folders: [
        {
          path: URI.file('home').resolve('folder1').toString(),
        },
      ],
      settings: {},
    };
    const data = WorkspaceData.transformToRelative(workspaceData as WorkspaceData, workspaceFile);

    expect(data.folders[0].path).toBe('folder1');
  });

  it('transformToAbsolute method should be work', () => {
    const workspaceFile = {
      uri: URI.file('home').resolve(`workspace.${DEFAULT_WORKSPACE_SUFFIX_NAME}`).toString(),
      isDirectory: false,
      lastModification: new Date().getTime(),
    };
    const workspaceData = {
      folders: [
        {
          path: 'folder1',
        },
      ],
      settings: {},
    };
    let data = WorkspaceData.transformToAbsolute(workspaceData as WorkspaceData, workspaceFile);

    expect(data.folders[0].path).toBe(URI.file('home').resolve('folder1').toString());

    const dotWorkspaceData = {
      folders: [
        {
          path: '.',
        },
      ],
      settings: {},
    };
    data = WorkspaceData.transformToAbsolute(dotWorkspaceData as WorkspaceData, workspaceFile);

    expect(data.folders[0].path).toBe(URI.file('home').toString());
  });
});
