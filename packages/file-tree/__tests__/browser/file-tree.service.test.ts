import { Injector } from '@ali/common-di';
import { URI } from '@ali/ide-core-common';
import { FileTreeService } from '../../src/browser';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IWorkspaceService, MockWorkspaceService } from '@ali/ide-workspace';
import { FileTreeAPI, MockFileTreeAPIImpl } from '../../src/common';
import { IFileServiceClient, MockFileServiceClient, FileStat } from '@ali/ide-file-service';
import { File, Directory } from '../../src/browser/file-tree-item';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { TEMP_FILE_NAME } from '@ali/ide-core-browser/lib/components';
import { CorePreferences } from '@ali/ide-core-browser';
import { IDialogService } from '@ali/ide-overlay';

describe('FileTreeService should be work', () => {
  let treeService: FileTreeService;
  let fileApi: FileTreeAPI;
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
        token: FileTreeAPI,
        useClass: MockFileTreeAPIImpl,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
    );

    injector.addProviders({
      token: FileTreeService,
      useClass: FileTreeService,
    });

    treeService = injector.get(FileTreeService);
    fileApi = injector.get(FileTreeAPI);

    rootUri = new URI(root);
    rootFile = new Directory(
      fileApi,
      rootUri,
      rootUri.displayName,
      {
        isDirectory: false,
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

    it('Should have enough API.', async () => {
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
      expect(typeof treeService.refresh).toBe('function');
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
      const fileName = 'file';
      const folderName = 'folder';
      const exists = jest.fn(() => {
        return false;
      });
      injector.mock(FileTreeAPI, 'exists', exists);
      const createFile = jest.fn();
      injector.mock(FileTreeAPI, 'createFile', createFile);
      await treeService.createFile(rootFile, fileName);
      expect(createFile).toBeCalledWith(rootUri.resolve(fileName));
      const createFolder = jest.fn();
      injector.mock(FileTreeAPI, 'createFolder', createFolder);
      await treeService.createFolder(rootFile, folderName);
      expect(createFolder).toBeCalledWith(rootUri.resolve(folderName));
      done();
    });

    it('removeStatusAndFileFromParent should be work', () => {
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

    it('can rename file', () => {
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
      injector.mock(FileTreeAPI, 'moveFile', moveFile);
      treeService.renameFile(childFile, newName);
      expect(moveFile).toBeCalledWith(childUri, childUri.parent.resolve(newName), false);
      expect(treeService.status.get(treeService.getStatutsKey(childFile))!.file.isTemporary).toBeFalsy();
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
      injector.mock(FileTreeAPI, 'deleteFile', deleteFile);
      await treeService.deleteFile(childUri);
    });

    it('comfirm view should be work while explorer.confirmMove === true', async (done) => {
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

      const warning = jest.fn();
      injector.mock(IDialogService, 'warning', warning);

      await treeService.moveFiles([childUri], rootUri);
      expect(warning).toBeCalled();
      done();
    });

  });

});
