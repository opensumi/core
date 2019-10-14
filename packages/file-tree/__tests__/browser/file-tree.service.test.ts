import { Injector } from '@ali/common-di';
import { URI } from '@ali/ide-core-browser';
import { FileTreeService } from '../../src/browser';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IWorkspaceService, MockWorkspaceService } from '@ali/ide-workspace';
import { FileTreeAPI, IFileTreeItem, MockFileTreeAPIImpl } from '../../src/common';
import { IFileServiceClient, MockFileServiceClient } from '@ali/ide-file-service';

describe('FileTreeService should be work', () => {
  let fileTreeService: FileTreeService;
  let injector: Injector;
  beforeAll(() => {
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

    fileTreeService = injector.get(FileTreeService);
  });

  afterAll(async () => {
  });

  describe('01 #Init', () => {

    it('Should have enough API.', async () => {
      expect(typeof fileTreeService.hasPasteFile).toBe('boolean');
      expect(typeof fileTreeService.isFocused).toBe('boolean');
      expect(typeof fileTreeService.isSelected).toBe('boolean');
      expect(typeof fileTreeService.isMutiWorkspace).toBe('boolean');
      expect(fileTreeService.root instanceof URI).toBeTruthy();
      expect(Array.isArray(fileTreeService.focusedUris)).toBeTruthy();
      expect(Array.isArray(fileTreeService.selectedUris)).toBeTruthy();
      expect(Array.isArray(fileTreeService.selectedFiles)).toBeTruthy();
      expect(Array.isArray(fileTreeService.focusedFiles)).toBeTruthy();

      expect(typeof fileTreeService.getStatutsKey).toBe('function');
      expect(typeof fileTreeService.getParent).toBe('function');
      expect(typeof fileTreeService.getChildren).toBe('function');
      expect(typeof fileTreeService.effectChange).toBe('function');
      expect(typeof fileTreeService.createFile).toBe('function');
      expect(typeof fileTreeService.createFolder).toBe('function');
      expect(typeof fileTreeService.removeStatusAndFileFromParent).toBe('function');
      expect(typeof fileTreeService.removeTempStatus).toBe('function');
      expect(typeof fileTreeService.createTempFile).toBe('function');
      expect(typeof fileTreeService.createTempFolder).toBe('function');
      expect(typeof fileTreeService.renameTempFile).toBe('function');
      expect(typeof fileTreeService.renameFile).toBe('function');
      expect(typeof fileTreeService.deleteFile).toBe('function');
      expect(typeof fileTreeService.moveFile).toBe('function');
      expect(typeof fileTreeService.moveFiles).toBe('function');
      expect(typeof fileTreeService.deleteFiles).toBe('function');
      expect(typeof fileTreeService.collapseAll).toBe('function');
      expect(typeof fileTreeService.refresh).toBe('function');
      expect(typeof fileTreeService.searchFileParent).toBe('function');
      expect(typeof fileTreeService.replaceFileName).toBe('function');
      expect(typeof fileTreeService.updateFilesSelectedStatus).toBe('function');
      expect(typeof fileTreeService.resetFilesSelectedStatus).toBe('function');
      expect(typeof fileTreeService.updateFilesFocusedStatus).toBe('function');
      expect(typeof fileTreeService.resetFilesFocusedStatus).toBe('function');
      expect(typeof fileTreeService.refreshExpandedFile).toBe('function');
      expect(typeof fileTreeService.updateFilesExpandedStatus).toBe('function');
      expect(typeof fileTreeService.updateFilesExpandedStatusByQueue).toBe('function');
      expect(typeof fileTreeService.updateFileStatus).toBe('function');
      expect(typeof fileTreeService.openFile).toBe('function');
      expect(typeof fileTreeService.openAndFixedFile).toBe('function');
      expect(typeof fileTreeService.openToTheSide).toBe('function');
      expect(typeof fileTreeService.compare).toBe('function');
      expect(typeof fileTreeService.copyFile).toBe('function');
      expect(typeof fileTreeService.cutFile).toBe('function');
      expect(typeof fileTreeService.pasteFile).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {

    it('init', async (done) => {
      await fileTreeService.init();
      expect(fileTreeService.files.length > 0).toBeTruthy();
      done();
    });

    it('getStatutsKey', async (done) => {
      const unknowPath = 'file://userhome/test.js';
      expect(fileTreeService.getStatutsKey(unknowPath)).toBe(unknowPath + '#');
      const unkonwUri = new URI(unknowPath);
      expect(fileTreeService.getStatutsKey(unkonwUri)).toBe(unkonwUri.toString() + '#');
      const unkonwSymbolicFileTree: IFileTreeItem = {
        name: 'test',
        filestat: {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: true,
          uri: unknowPath,
        },
        priority: 0,
        uri: unkonwUri,
        id: 0,
        parent: undefined,
      };
      expect(fileTreeService.getStatutsKey(unkonwSymbolicFileTree)).toBe(unkonwSymbolicFileTree.uri.toString() + '#');
      const unkonwFileTree: IFileTreeItem = {
        name: 'test',
        filestat: {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: unknowPath,
        },
        priority: 0,
        uri: unkonwUri,
        id: 0,
        parent: undefined,
      };
      expect(fileTreeService.getStatutsKey(unkonwFileTree)).toBe(unkonwFileTree.uri.toString());
      done();
    });
  });

});
