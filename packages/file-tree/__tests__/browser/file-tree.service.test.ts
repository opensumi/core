import { Injectable, Injector } from '@ali/common-di';
import { URI, FileUri } from '@ali/ide-core-browser';
import { FileTreeService } from '../../lib';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockedWorkspaceService } from '@ali/ide-workspace/lib/browser/__mocks__/workspace-service.mock';
import { IWorkspaceService } from '@ali/ide-workspace';

describe('FileTreeService should be work', () => {
  let fileTreeService: FileTreeService;
  let injector: Injector;
  beforeAll(() => {
    injector = createBrowserInjector([]);

    injector.addProviders({
      token: FileTreeService,
      useClass: FileTreeService,
    });

    // mock used instance
    injector.addProviders(
      {
        token: IWorkspaceService,
        useValue: MockedWorkspaceService,
      },
    );

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

});
