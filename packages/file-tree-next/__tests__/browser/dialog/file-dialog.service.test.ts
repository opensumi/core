import { TreeNodeType } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-browser';
import { LabelService } from '@opensumi/ide-core-browser/lib/services';
import { FileStat } from '@opensumi/ide-file-service';
import { FileTreeDialogService } from '@opensumi/ide-file-tree-next/lib/browser/dialog/file-dialog.service';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { IFileTreeAPI } from '../../../src/common';
import { Directory, File } from '../../../src/common/file-tree-node.define';


class TempDirectory {}
class TempFile {}

describe('FileDialogService should be work', () => {
  let injector: MockInjector;
  let fileTreeDialogService: FileTreeDialogService;
  const rootUri = URI.file('/userhome');
  const newFileByName = (name) => {
    const file = {
      uri: rootUri.resolve(name),
      name,
      filestat: {
        uri: rootUri.resolve(name).toString(),
        isDirectory: false,
        lastModification: new Date().getTime(),
      },
      type: TreeNodeType.TreeNode,
    } as File;
    file.constructor = new TempFile().constructor;
    return file;
  };
  const newDirectoryByName = (name) => {
    const directory = {
      uri: rootUri.resolve(name),
      name,
      filestat: {
        uri: rootUri.resolve(name).toString(),
        isDirectory: true,
        lastModification: new Date().getTime(),
      },
      type: TreeNodeType.CompositeTreeNode,
    } as Directory;
    directory.constructor = new TempDirectory().constructor;
    return directory;
  };
  const mockFileTreeAPI = {
    resolveFileStat: jest.fn(),
    resolveChildren: jest.fn(),
  };
  beforeEach(async (done) => {
    injector = createBrowserInjector([]);

    injector.overrideProviders(
      {
        token: IFileTreeAPI,
        useValue: mockFileTreeAPI,
      },
      {
        token: IWorkspaceService,
        useValue: {
          roots: [
            {
              uri: rootUri.toString(),
              lastModification: new Date().getTime(),
              isDirectory: true,
            } as FileStat,
          ],
        },
      },
      {
        token: LabelService,
        useValue: {},
      },
    );
    mockFileTreeAPI.resolveFileStat.mockResolvedValue({
      uri: rootUri.toString(),
      lastModification: new Date().getTime(),
      isDirectory: true,
    } as FileStat);
    mockFileTreeAPI.resolveChildren.mockResolvedValue({
      children: [
        {
          ...newDirectoryByName('child'),
          ensureLoaded: jest.fn(),
        },
      ],
      filestat: {},
    });
    fileTreeDialogService = injector.get(FileTreeDialogService, [rootUri.toString()]);
    await fileTreeDialogService.whenReady;
    done();
  });

  afterEach(() => {
    injector.disposeAll();
    mockFileTreeAPI.resolveFileStat.mockReset();
    mockFileTreeAPI.resolveChildren.mockReset();
    mockFileTreeAPI.resolveFileStat.mockReset();
  });

  it('resolveChildren method should be work', async (done) => {
    const children = await fileTreeDialogService.resolveChildren();
    expect(mockFileTreeAPI.resolveChildren).toBeCalledTimes(1);
    expect(children.length > 0).toBeTruthy();
    await fileTreeDialogService.resolveChildren(children![0] as Directory);
    expect(mockFileTreeAPI.resolveChildren).toBeCalledTimes(2);
    done();
  });

  it('resolveRoot method should be work', async (done) => {
    await fileTreeDialogService.resolveRoot(rootUri.toString());
    expect(mockFileTreeAPI.resolveFileStat).toBeCalledTimes(2);
    expect(mockFileTreeAPI.resolveChildren).toBeCalledTimes(1);
    done();
  });

  it('getDirectoryList method should be work', async (done) => {
    await fileTreeDialogService.resolveRoot(rootUri.toString());
    const directory = fileTreeDialogService.getDirectoryList();
    expect(directory.length === 1).toBeTruthy();
    done();
  });

  it('sortComparator method should be work', () => {
    let res = fileTreeDialogService.sortComparator(newFileByName('a'), newDirectoryByName('a'));
    expect(res).toBe(1);
    res = fileTreeDialogService.sortComparator(newFileByName('a'), newFileByName('b'));
    expect(res).toBe(-1);
    res = fileTreeDialogService.sortComparator(newDirectoryByName('a'), newDirectoryByName('b'));
    expect(res).toBe(-1);
    res = fileTreeDialogService.sortComparator(newDirectoryByName('a'), newDirectoryByName('a'));
    expect(res).toBe(0);
    res = fileTreeDialogService.sortComparator(newFileByName('a'), newFileByName('a'));
  });
});
