import { URI, localize } from '@ali/ide-core-common';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { IWorkspaceService } from '@ali/ide-workspace';
import { IFileTreeAPI } from '../../src/common';
import { IFileServiceClient, FileStat } from '@ali/ide-file-service';
import { File, Directory } from '../../src/browser/file-tree-item';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { FileTreeAPI } from '../../src/browser/file-tree.api';
import { IWorkspaceEditService } from '@ali/ide-workspace-edit';
import { EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { MockFileServiceClient } from '@ali/ide-file-service/lib/common/mocks';

describe('FileTreeService should be work', () => {
  let fileApi: IFileTreeAPI;
  let injector: MockInjector;
  let fileService: IFileServiceClient;
  const userHome: string = 'file://userhome';
  beforeEach(() => {
    injector = createBrowserInjector([]);

    // mock used instance
    injector.overrideProviders(
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: IFileServiceClient,
        useClass: MockFileServiceClient,
      },
      {
        token: LabelService,
        useValue: {
          getIcon: () => { },
          getName: () => { },
        },
      },
    );

    injector.addProviders({
      token: IFileTreeAPI,
      useClass: FileTreeAPI,
    });

    fileApi = injector.get(IFileTreeAPI);
    // injector.mock的前提条件需要实例已创建
    fileService = injector.get(IFileServiceClient);
  });

  describe('01 #Init', () => {
    it('should have enough API', async () => {
      expect(typeof fileApi.getFiles).toBe('function');
      expect(typeof fileApi.getFileStat).toBe('function');
      expect(typeof fileApi.createFile).toBe('function');
      expect(typeof fileApi.createFolder).toBe('function');
      expect(typeof fileApi.exists).toBe('function');
      expect(typeof fileApi.deleteFile).toBe('function');
      expect(typeof fileApi.moveFile).toBe('function');
      expect(typeof fileApi.copyFile).toBe('function');
      expect(typeof fileApi.fileStat2FileTreeItem).toBe('function');
      expect(typeof fileApi.getReadableTooltip).toBe('function');
      expect(typeof fileApi.generatorFileFromFilestat).toBe('function');
      expect(typeof fileApi.generatorTempFile).toBe('function');
      expect(typeof fileApi.generatorTempFolder).toBe('function');
      expect(typeof fileApi.sortByNumberic).toBe('function');

    });
  });

  describe('02 #API should be worked.', () => {
    it('getFiles should be work while there has not file', async (done) => {
      const getCurrentUserHome = jest.fn(() => {
        return {
          uri: userHome,
        };
      });
      injector.mock(IFileServiceClient, 'getCurrentUserHome', getCurrentUserHome);
      const getFileStat = jest.fn();
      injector.mock(IFileServiceClient, 'getFileStat', getFileStat);
      const files = await fileApi.getFiles(userHome);
      expect(getCurrentUserHome).toBeCalledTimes(1);
      expect(getFileStat).toBeCalledTimes(1);
      expect(files.length === 0).toBeTruthy();
      done();
    });

    it('getFiles should be work while there has file', async (done) => {
      const getCurrentUserHome = jest.fn(() => {
        return {
          uri: userHome,
        };
      });
      injector.mock(IFileServiceClient, 'getCurrentUserHome', getCurrentUserHome);
      const getFileStat = jest.fn(() => {
        return {
          uri: userHome,
          isDirectory: true,
          lastModification: 0,
        } as FileStat;
      });
      injector.mock(IFileServiceClient, 'getFileStat', getFileStat);
      const files = await fileApi.getFiles(userHome);
      expect(getCurrentUserHome).toBeCalledTimes(1);
      expect(getFileStat).toBeCalledWith(userHome);
      expect(files.length === 1).toBeTruthy();
      expect(files[0].uri.isEqual(new URI(userHome))).toBeTruthy();
      done();
    });

    it('getFileStat should be work', async (done) => {
      const fileStat = {
        uri: userHome,
        isDirectory: true,
      } as FileStat;
      const getFileStat = jest.fn(() => {
        return fileStat;
      });
      injector.mock(IFileServiceClient, 'getFileStat', getFileStat);
      const newFileStat = await fileApi.getFileStat(userHome);
      expect(getFileStat).toBeCalledWith(userHome);
      expect(newFileStat).toBe(fileStat);
      done();
    });

    it('createFile should be work', async (done) => {
      const createFIleUri = new URI(`${userHome}/file.js`);
      const apply = jest.fn();
      injector.addProviders({
        token: IWorkspaceEditService,
        useValue: {
          apply,
        },
      });
      const openResouce = jest.fn();
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openResouce);
      await fileApi.createFile(createFIleUri);
      expect(apply).toBeCalledTimes(1);
      expect(openResouce).toBeCalledWith(createFIleUri);
      done();
    });

    it('createFolder should be work', async (done) => {
      const createFolderUri = new URI(`${userHome}/folder`);
      const createFolder = jest.fn();
      injector.mock(IFileServiceClient, 'createFolder', createFolder);
      await fileApi.createFolder(createFolderUri);
      expect(createFolder).toBeCalledWith(createFolderUri.toString());
      done();
    });

    it('exists should be work', async (done) => {
      const existsFileUri = new URI(`${userHome}/folder`);
      const exists = jest.fn(() => true);
      injector.mock(IFileServiceClient, 'exists', exists);
      const isExist = await fileApi.exists(existsFileUri);
      expect(isExist).toBeTruthy();
      expect(exists).toBeCalledWith(existsFileUri.toString());
      done();
    });

    it('deleteFile should be work', async (done) => {
      const deleteFIleUri = new URI(`${userHome}/file.js`);
      const apply = jest.fn();
      injector.addProviders({
        token: IWorkspaceEditService,
        useValue: {
          apply,
        },
      });
      await fileApi.deleteFile(deleteFIleUri);
      expect(apply).toBeCalledTimes(1);
      expect(apply).toBeCalledWith({
        edits: [{
          oldUri: deleteFIleUri,
          options: {},
        }],
      });
      done();
    });

    it('moveFile should be work', async (done) => {
      const fromUri = new URI(`${userHome}/from.js`);
      const toUri = new URI(`${userHome}//to`);
      const isDirectory = false;
      const apply = jest.fn();
      injector.addProviders({
        token: IWorkspaceEditService,
        useValue: {
          apply,
        },
      });
      await fileApi.moveFile(fromUri, toUri, isDirectory);
      expect(apply).toBeCalledTimes(1);
      expect(apply).toBeCalledWith({
        edits: [{
          newUri: toUri,
          oldUri: fromUri,
          options: {
            isDirectory,
            overwrite: true,
          },
        }],
      });
      done();
    });

    it('copyFile should be work', async (done) => {
      const fromUri = new URI(`${userHome}/from.js`);
      const toUri = new URI(`${userHome}//to`);
      const copy = jest.fn();
      injector.mock(IFileServiceClient, 'copy', copy);
      await fileApi.copyFile(fromUri, toUri);
      expect(copy).toBeCalledWith(fromUri.toString(), toUri.toString());
      done();
    });

    it('fileStat2FileTreeItem should be work', () => {
      const directoryFileStat: FileStat = {
        uri: userHome,
        isDirectory: true,
        lastModification: 0,
        children: [],
      };
      const fileFileStat: FileStat = {
        uri: userHome,
        isDirectory: false,
        lastModification: 0,
      };
      let item = fileApi.fileStat2FileTreeItem(directoryFileStat, undefined);
      expect(Directory.isDirectory(item)).toBeTruthy();
      item = fileApi.fileStat2FileTreeItem(fileFileStat, undefined);
      expect(Directory.isDirectory(item)).toBeFalsy();
    });

    it('getReadableTooltip should be work', async (done) => {
      const parent = new URI(userHome).resolve('parent');
      // 初始化userhome路径
      injector.mock(IFileTreeAPI, 'userhomePath', parent);
      const testUri = parent.resolve('test.js');
      const tooltip = await fileApi.getReadableTooltip(testUri);
      expect(tooltip).toBe('~/test.js');
      done();
    });

    it('generatorFileFromFilestat should be work', () => {
      const rootUri = new URI(userHome);
      const root = new Directory(
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
      const directoryFileStat: FileStat = {
        uri: rootUri.resolve('folder').toString(),
        isDirectory: true,
        lastModification: 0,
        children: [],
      };
      const fileFileStat: FileStat = {
        uri: rootUri.resolve('file').toString(),
        isDirectory: false,
        lastModification: 0,
      };
      let item = fileApi.generatorFileFromFilestat(directoryFileStat, root);
      expect(Directory.isDirectory(item)).toBeTruthy();
      item = fileApi.generatorFileFromFilestat(fileFileStat, root);
      expect(Directory.isDirectory(item)).toBeFalsy();
    });

    it('can generate file template', () => {
      const rootUri = new URI(userHome);
      const root = new Directory(
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
      const uri = rootUri.resolve('temp');
      const file = fileApi.generatorTempFile(uri, root);
      expect(Directory.isDirectory(file)).toBeFalsy();
      expect(file.uri.isEqual(uri)).toBeTruthy();
    });

    it('can generate folder template', () => {
      const rootUri = new URI(userHome);
      const root = new Directory(
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
      const uri = rootUri.resolve('temp');
      const file = fileApi.generatorTempFolder(uri, root);
      expect(Directory.isDirectory(file)).toBeTruthy();
      expect(file.uri.isEqual(uri)).toBeTruthy();
    });

    it('sortByNumberic should be work', () => {
      const testZeroDirectoryUri = new URI(userHome).resolve('test_0');
      const testZeroDirectory = new Directory(
        fileApi,
        testZeroDirectoryUri,
        testZeroDirectoryUri.displayName,
        {
          isDirectory: true,
          lastModification: 0,
          isSymbolicLink: false,
          uri: testZeroDirectoryUri.toString(),
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );
      const testOneDirectoryUri = new URI(userHome).resolve('test_1');
      const testOneDirectory = new Directory(
        fileApi,
        testOneDirectoryUri,
        testOneDirectoryUri.displayName,
        {
          isDirectory: true,
          lastModification: 0,
          isSymbolicLink: false,
          uri: testOneDirectoryUri.toString(),
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );
      const testZeroFileUri = new URI(userHome).resolve('test_0');
      const testZeroFile = new File(
        fileApi,
        testZeroFileUri,
        testZeroFileUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: testZeroFileUri.toString(),
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );
      const testOneFileUri = new URI(userHome).resolve('test_1');
      const testOneFile = new File(
        fileApi,
        testOneFileUri,
        testOneFileUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: testOneFileUri.toString(),
        } as FileStat,
        '',
        '',
        undefined,
        1,
      );
      const highPorityFileUri = new URI(userHome).resolve('test_0');
      const highPorityFile = new File(
        fileApi,
        highPorityFileUri,
        highPorityFileUri.displayName,
        {
          isDirectory: false,
          lastModification: 0,
          isSymbolicLink: false,
          uri: highPorityFileUri.toString(),
        } as FileStat,
        '',
        '',
        undefined,
        10,
      );
      // 文件夹按数字->字典排序
      let sortResult = fileApi.sortByNumberic([testOneDirectory, testZeroDirectory]);
      expect(sortResult[0].uri.isEqual(testZeroDirectory.uri)).toBeTruthy();
      expect(sortResult[1].uri.isEqual(testOneDirectory.uri)).toBeTruthy();
      // 文件按数字->字典排序
      sortResult = fileApi.sortByNumberic([testOneFile, testZeroFile]);
      expect(sortResult[0].uri.isEqual(testZeroFile.uri)).toBeTruthy();
      expect(sortResult[1].uri.isEqual(testOneFile.uri)).toBeTruthy();
      // 文件夹排序优先级高于文件
      sortResult = fileApi.sortByNumberic([testOneFile, testZeroDirectory]);
      expect(sortResult[0].uri.isEqual(testZeroDirectory.uri)).toBeTruthy();
      expect(sortResult[1].uri.isEqual(testOneFile.uri)).toBeTruthy();
      // pority级别越高，排序越靠前
      sortResult = fileApi.sortByNumberic([testOneFile, testZeroDirectory, highPorityFile]);
      expect(sortResult[0].uri.isEqual(highPorityFile.uri)).toBeTruthy();
      expect(sortResult[1].uri.isEqual(testZeroDirectory.uri)).toBeTruthy();
      expect(sortResult[2].uri.isEqual(testOneFile.uri)).toBeTruthy();
    });
  });
});
