import { URI, localize } from '@ali/ide-core-common';
import { FileTreeService } from '../../src/browser/file-tree.service';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IFileTreeAPI } from '../../src/common';
import { MockFileTreeAPIImpl } from '../../src/common/mocks';
import { IFileServiceClient, FileStat } from '@ali/ide-file-service';
import { File, Directory } from '../../src/browser/file-tree-item';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { CorePreferences, EDITOR_COMMANDS, IContextKeyService } from '@ali/ide-core-browser';
import { IDialogService } from '@ali/ide-overlay';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';

describe('FileTreeService should be work', () => {
  let treeService: FileTreeService;
  let fileApi: IFileTreeAPI;
  let injector: MockInjector;
  const root = 'file://userhome';
  let rootUri: URI = new URI(root);
  let rootFile: Directory;
  beforeEach(() => {
    injector = createBrowserInjector([]);

    // mock used instance
    injector.overrideProviders(
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IFileTreeAPI,
        useClass: MockFileTreeAPIImpl,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
    );

    injector.addProviders({
      token: FileTreeService,
      useClass: FileTreeService,
    });

    treeService = injector.get(FileTreeService);
    fileApi = injector.get(IFileTreeAPI);

    rootUri = new URI(root);
    rootFile = new Directory(
      fileApi,
      rootUri,
      rootUri.displayName,
      {
        isDirectory: true,
        lastModification: 0,
        isSymbolicLink: false,
        uri: rootUri.toString(),
      } as FileStat,
      '',
      '',
      undefined,
      1,
    );
    treeService.updateFileStatus([rootFile]);
  });

  afterEach(async () => {
    injector.disposeAll();
  });

  describe('01 #Init', () => {

    it('should have enough API', async () => {
      expect(typeof treeService.hasPasteFile).toBe('boolean');
      expect(typeof treeService.isFocused).toBe('boolean');
      expect(typeof treeService.isSelected).toBe('boolean');
      expect(typeof treeService.isMutiWorkspace).toBe('boolean');
      expect(treeService.root instanceof URI).toBeTruthy();
      expect(Array.isArray(treeService.focusedUris)).toBeTruthy();
      expect(Array.isArray(treeService.selectedUris)).toBeTruthy();
      expect(Array.isArray(treeService.selectedFiles)).toBeTruthy();
      expect(Array.isArray(treeService.focusedFiles)).toBeTruthy();

      expect(typeof treeService.getStatutsKey).toBe('function');
      expect(typeof treeService.getParent).toBe('function');
      expect(typeof treeService.getChildren).toBe('function');
      expect(typeof treeService.createFile).toBe('function');
      expect(typeof treeService.createFolder).toBe('function');
      expect(typeof treeService.removeStatusAndFileFromParent).toBe('function');
      expect(typeof treeService.removeTempStatus).toBe('function');
      expect(typeof treeService.createTempFile).toBe('function');
      expect(typeof treeService.createTempFolder).toBe('function');
      expect(typeof treeService.renameTempFile).toBe('function');
      expect(typeof treeService.renameFile).toBe('function');
      expect(typeof treeService.deleteFile).toBe('function');
      expect(typeof treeService.moveFile).toBe('function');
      expect(typeof treeService.moveFiles).toBe('function');
      expect(typeof treeService.deleteFiles).toBe('function');
      expect(typeof treeService.collapseAll).toBe('function');
      expect(typeof treeService.refresh).toBe('function');
      expect(typeof treeService.searchFileParent).toBe('function');
      expect(typeof treeService.replaceFileName).toBe('function');
      expect(typeof treeService.updateFilesSelectedStatus).toBe('function');
      expect(typeof treeService.resetFilesSelectedStatus).toBe('function');
      expect(typeof treeService.updateFilesFocusedStatus).toBe('function');
      expect(typeof treeService.resetFilesFocusedStatus).toBe('function');
      expect(typeof treeService.updateFilesExpandedStatus).toBe('function');
      expect(typeof treeService.updateFilesExpandedStatusByQueue).toBe('function');
      expect(typeof treeService.updateFileStatus).toBe('function');
      expect(typeof treeService.openFile).toBe('function');
      expect(typeof treeService.openAndFixedFile).toBe('function');
      expect(typeof treeService.openToTheSide).toBe('function');
      expect(typeof treeService.compare).toBe('function');
      expect(typeof treeService.copyFile).toBe('function');
      expect(typeof treeService.cutFile).toBe('function');
      expect(typeof treeService.pasteFile).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {

    it('init', async (done) => {
      await treeService.init();
      expect(treeService.files.length > 0).toBeTruthy();
      done();
    });

    it('can get symbolic or unsymbolic file with correct statusKey', async (done) => {
      const unknowPath = `${root}/unkonw.js`;
      expect(treeService.getStatutsKey(unknowPath)).toBe(unknowPath + '#');
      const unkonwUri = new URI(unknowPath);
      expect(treeService.getStatutsKey(unkonwUri)).toBe(unkonwUri.toString() + '#');
      const unkonwSymbolicFileTree: File = new File(
        fileApi,
        unkonwUri,
        unkonwUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: true,
          uri: unknowPath,
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );

      expect(treeService.getStatutsKey(unkonwSymbolicFileTree)).toBe(unkonwSymbolicFileTree.uri.toString() + '#');
      const unkonwFileTree: File = new File(
        fileApi,
        unkonwUri,
        unkonwUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: unknowPath,
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );
      expect(treeService.getStatutsKey(unkonwFileTree)).toBe(unkonwFileTree.uri.toString());
      done();
    });

    it('getParent and getChildren should be work', () => {
      const parentUri = new URI(`${root}/parent`);
      const childUri = new URI(`${root}/parent/child.js`);
      expect(treeService.getParent(parentUri)).toBeUndefined();
      expect(treeService.getParent(childUri)).toBeUndefined();
      const parentFile: Directory = new Directory(
        fileApi,
        parentUri,
        parentUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: parentUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([parentFile]);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        parentFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      expect(treeService.getParent(childUri)!.uri.isEqual(parentUri)).toBeTruthy();
      parentFile.addChildren(childFile);
      expect(treeService.getChildren(parentUri)!.length).toBe(1);
      expect(treeService.getChildren(parentUri)![0].uri.isEqual(childUri)).toBeTruthy();
    });

    it('createFile and createFolder should be work', async (done) => {
      const childUri = new URI(`${root}/child.js`);
      const newName = 'newName';
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      const fileName = 'file';
      const folderName = 'folder';
      const exists = jest.fn(() => {
        return false;
      });
      injector.mock(IFileTreeAPI, 'exists', exists);
      const createFile = jest.fn();
      injector.mock(IFileTreeAPI, 'createFile', createFile);
      await treeService.createFile(childFile, fileName);
      expect(createFile).toBeCalledWith(rootUri.resolve(fileName));
      const createFolder = jest.fn();
      injector.mock(IFileTreeAPI, 'createFolder', createFolder);
      await treeService.createFolder(childFile, folderName);
      expect(createFolder).toBeCalledWith(rootUri.resolve(folderName));
      // 新建的文件已生成
      const parentStatusKey = treeService.getStatutsKey(childUri.parent);
      const parentStatus = treeService.status.get(parentStatusKey);
      const parent = parentStatus!.file as Directory;
      expect(parent.hasChildren(childUri.parent.resolve(fileName))).toBeTruthy();
      expect(parent.hasChildren(childUri.parent.resolve(folderName))).toBeTruthy();
      done();
    });

    it('removeStatusAndFileFromParent should be work', () => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      expect(!!treeService.status.get(treeService.getStatutsKey(childUri))).toBeTruthy();
      treeService.removeStatusAndFileFromParent(childUri);
      expect(treeService.getChildren(rootUri)!.length === 0).toBeTruthy();
      expect(!!treeService.status.get(treeService.getStatutsKey(childUri))).toBeFalsy();
    });

    it('can create/remove template file or folder', () => {
      treeService.createTempFile(rootUri);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      expect(treeService.getChildren(rootUri)![0].uri.displayName).toBe(TEMP_FILE_NAME);
      expect(treeService.getChildren(rootUri)![0].filestat.isDirectory).toBeFalsy();
      treeService.removeTempStatus();
      expect(treeService.getChildren(rootUri)!.length === 0).toBeTruthy();
      treeService.createTempFolder(rootUri);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      expect(treeService.getChildren(rootUri)![0].uri.displayName).toBe(TEMP_FILE_NAME);
      expect(treeService.getChildren(rootUri)![0].filestat.isDirectory).toBeTruthy();
      treeService.removeTempStatus();
      expect(treeService.getChildren(rootUri)!.length === 0).toBeTruthy();
    });

    it('can covert a file to template file', () => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      treeService.renameTempFile(childUri);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      expect(treeService.getChildren(rootUri)![0].isTemporary).toBeTruthy();
    });

    it('can rename file', async (done) => {
      const childUri = new URI(`${root}/child.js`);
      const newName = 'newName';
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      const moveFile = jest.fn();
      const exists = jest.fn(() => false);
      injector.mock(IFileTreeAPI, 'moveFile', moveFile);
      injector.mock(IFileTreeAPI, 'exists', exists);
      await treeService.renameFile(childFile, newName);
      expect(moveFile).toBeCalledWith(childUri, childUri.parent.resolve(newName), false);
      expect(exists).toBeCalledWith(childUri.parent.resolve(newName));
      expect(treeService.status.get(treeService.getStatutsKey(childFile))!.file.isTemporary).toBeFalsy();
      // 重命名后的文件已生成
      const parentStatusKey = treeService.getStatutsKey(childUri.parent);
      const parentStatus = treeService.status.get(parentStatusKey);
      const parent = parentStatus!.file as Directory;
      expect(parent.hasChildren(childUri)).toBeFalsy();
      expect(parent.hasChildren(childUri.parent.resolve(newName))).toBeTruthy();
      done();
    });

    it('delete file should be work', async (done) => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      const deleteFile = (uri: URI) => {
        expect(uri.isEqual(childUri)).toBeTruthy();
        done();
      };
      injector.mock(IFileTreeAPI, 'deleteFile', deleteFile);
      await treeService.deleteFile(childUri);
    });

    it('comfirm view should be work while explorer.confirmMove === true', async (done) => {
      const childUri = new URI(`${root}/parent/child.js`);
      const existsChildUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      const existsFile: File = new File(
        fileApi,
        existsChildUri,
        existsChildUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: existsChildUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile, existsFile]);
      rootFile.addChildren(childFile);
      rootFile.addChildren(existsFile);
      expect(treeService.getChildren(rootUri)!.length > 0).toBeTruthy();
      injector.overrideProviders({
        token: CorePreferences,
        useValue: {
          'explorer.confirmMove': true,
        },
      });
      injector.overrideProviders({
        token: IDialogService,
        useValue: {},
      });

      const warning = jest.fn(() => {
        return localize('file.comfirm.replace.ok');
      });
      injector.mock(IDialogService, 'warning', warning);
      const moveFile = jest.fn();
      injector.mock(IFileTreeAPI, 'moveFile', moveFile);
      await treeService.moveFiles([childUri], rootUri);
      expect(warning).toBeCalledTimes(2);
      expect(moveFile).toBeCalledTimes(1);
      done();
    });

    it('comfirm view should be work while explorer.confirmDelete === true', async (done) => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      injector.overrideProviders({
        token: CorePreferences,
        useValue: {
          'explorer.confirmDelete': true,
        },
      });
      injector.overrideProviders({
        token: IDialogService,
        useValue: {},
      });
      const warning = jest.fn(() => {
        return localize('file.comfirm.delete.ok');
      });
      injector.mock(IDialogService, 'warning', warning);
      const deleteFile = jest.fn();
      injector.mock(IFileTreeAPI, 'deleteFile', deleteFile);
      await treeService.deleteFiles([childUri]);
      expect(warning).toBeCalledTimes(1);
      expect(deleteFile).toBeCalledTimes(1);
      done();
    });

    it('update/reset file selected status should be work', () => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      treeService.updateFilesSelectedStatus([childFile], false);
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeFalsy();
      treeService.updateFilesSelectedStatus([childFile], true);
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeTruthy();
      treeService.resetFilesSelectedStatus();
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeFalsy();
    });

    it('update/reset file focused status should be work', () => {
      const childUri = new URI(`${root}/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([childFile]);
      rootFile.addChildren(childFile);
      // reset focused just reset focused status
      treeService.updateFilesFocusedStatus([childFile], false);
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeFalsy();
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.focused).toBeFalsy();
      treeService.updateFilesFocusedStatus([childFile], true);
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeFalsy();
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.focused).toBeTruthy();
      treeService.resetFilesFocusedStatus();
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.focused).toBeFalsy();
      expect(treeService.status.get(treeService.getStatutsKey(childUri))!.selected).toBeFalsy();
    });

    it('can collapse all item without params', async (done) => {
      const childUri = new URI(`${root}/parent/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      const parentUri = new URI(`${root}/parent`);
      const parentFile: Directory = new Directory(
        fileApi,
        parentUri,
        parentUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: parentUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([parentFile]);
      rootFile.addChildren(parentFile);
      const getFiles = jest.fn(() => {
        return [{ children: [childFile] }];
      });
      injector.mock(IFileTreeAPI, 'getFiles', getFiles);
      const statusKey = treeService.getStatutsKey(parentUri);
      await treeService.updateFilesExpandedStatus(parentFile);
      expect(treeService.status.get(statusKey)!.expanded).toBeTruthy();
      expect(getFiles).toBeCalledTimes(1);
      await treeService.collapseAll();
      expect(treeService.status.get(statusKey)!.expanded).toBeFalsy();
      done();
    });

    it('can collapse all item with params', async (done) => {
      const childUri = new URI(`${root}/parent/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      const parentUri = new URI(`${root}/parent`);
      const parentFile: Directory = new Directory(
        fileApi,
        parentUri,
        parentUri.displayName,
        {
          isDirectory: true,
          lastModification: 0,
          isSymbolicLink: false,
          uri: parentUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([parentFile]);
      rootFile.addChildren(parentFile);
      const getFiles = jest.fn(() => {
        return [{ children: [childFile] }];
      });
      injector.mock(IFileTreeAPI, 'getFiles', getFiles);
      const statusKey = treeService.getStatutsKey(parentUri);
      await treeService.updateFilesExpandedStatus(parentFile);
      expect(treeService.status.get(statusKey)!.expanded).toBeTruthy();
      expect(getFiles).toBeCalledTimes(1);
      treeService.collapseAll(rootUri);
      expect(treeService.status.get(statusKey)!.expanded).toBeFalsy();
      done();
    });

    it('refresh should be work', async (done) => {
      const childUri = new URI(`${root}/parent/child.js`);
      const childFile: File = new File(
        fileApi,
        childUri,
        childUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: childUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      const getFiles = jest.fn(() => {
        return [{ children: [childFile] }];
      });
      injector.mock(IFileTreeAPI, 'getFiles', getFiles);
      await treeService.refresh(rootUri);
      const status: any = treeService.status.get(treeService.getStatutsKey(rootUri));
      expect(status.file.children.length > 0).toBeTruthy();
      expect(status.file.children[0].uri.isEqual(childUri)).toBeTruthy();
      done();
    });

    it('update files expended status by queue should be work', async (done) => {
      const parentUri = new URI(`${root}/parent`);
      const parentFile: Directory = new Directory(
        fileApi,
        parentUri,
        parentUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: parentUri.toString(),
        } as FileStat,
        '',
        '',
        rootFile,
        1,
      );
      treeService.updateFileStatus([parentFile]);
      rootFile.addChildren(parentFile);
      await treeService.updateFilesExpandedStatus(rootFile);
      const rootStatusKey = treeService.getStatutsKey(rootUri);
      const parentStatusKey = treeService.getStatutsKey(parentUri);
      const getFiles = jest.fn(() => {
        return [{ children: [] }];
      });
      injector.mock(IFileTreeAPI, 'getFiles', getFiles);
      expect(treeService.status.get(parentStatusKey)!.expanded).toBeFalsy();
      expect(treeService.status.get(rootStatusKey)!.expanded).toBeFalsy();
      await treeService.updateFilesExpandedStatusByQueue([rootUri, parentUri]);
      expect(getFiles).toBeCalledTimes(1);
      expect(treeService.status.get(parentStatusKey)!.expanded).toBeTruthy();
      expect(treeService.status.get(rootStatusKey)!.expanded).toBeTruthy();
      done();
    });

    it('should open file with preview mode while editor.previewMode === true', () => {
      const firstCall = jest.fn();
      const openUri = new URI(`${root}/child.js`);
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, firstCall);
      injector.overrideProviders({
        token: CorePreferences,
        useValue: {
          'editor.previewMode': true,
        },
      });
      treeService.openFile(openUri);
      expect(firstCall).toBeCalledWith(openUri, { disableNavigate: true, preview: true });
      injector.mock(CorePreferences, 'editor.previewMode', false);
      const thirdCall = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, thirdCall);
      treeService.openFile(openUri);
      expect(thirdCall).toBeCalledWith(openUri, { disableNavigate: true, preview: false });
    });
  });

  it('open file with fixed should be work', () => {
    const openResouceMock = jest.fn();
    const openUri = new URI(`${root}/child.js`);
    injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openResouceMock);
    treeService.openAndFixedFile(openUri);
    expect(openResouceMock).toBeCalledWith(openUri, { disableNavigate: false, preview: false });
  });

  it('open file to the side should be work', () => {
    const openResouceMock = jest.fn();
    const openUri = new URI(`${root}/child.js`);
    injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openResouceMock);
    treeService.openToTheSide(openUri);
    expect(openResouceMock).toBeCalledWith(openUri, { disableNavigate: false, split: 4 /** right */ });
  });

  it('comare file should be work', () => {
    const compareMock = jest.fn();
    const original = new URI(`${root}/child.js`);
    const modified = new URI(`${root}/parent`);
    injector.mockCommand(EDITOR_COMMANDS.COMPARE.id, compareMock);
    treeService.compare(original, modified);
    expect(compareMock).toBeCalledWith({
      original,
      modified,
    });
  });

  it('copy/cut/paste file should be work', () => {
    const child = new URI(`${root}/child.js`);
    const parent = new URI(`${root}/parent`);
    const moveFile = jest.fn();
    injector.mock(IFileTreeAPI, 'moveFile', moveFile);
    const copyFile = jest.fn();
    injector.mock(IFileTreeAPI, 'copyFile', copyFile);
    treeService.copyFile([child, parent]);
    treeService.pasteFile(rootUri);
    expect(copyFile).toBeCalledTimes(2);
    treeService.cutFile([child, parent]);
    treeService.pasteFile(rootUri);
    expect(moveFile).toBeCalledTimes(2);
  });

});
