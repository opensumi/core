import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileUri, URI, IFileServiceClient, Disposable, StorageProvider } from '@ali/ide-core-common';
import { FileTreeNextModule } from '../../src';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat, FileServicePath } from '@ali/ide-file-service';
import { FileTreeModelService } from '../../src/browser/services/file-tree-model.service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileSystemNodeOptions, FileService } from '@ali/ide-file-service/lib/node';
import { AppConfig } from '@ali/ide-core-node';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';
import { MockedStorageProvider } from '@ali/ide-core-browser/lib/mocks/storage';

describe('FileTree should be work while on single workspace model', () => {
  let track;
  let injector: MockInjector;
  let root: URI;
  let fileTreeModelService: FileTreeModelService;
  beforeEach(async (done) => {
    track = temp.track();
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('file-tree-root')));
    injector = createBrowserInjector([
      FileTreeNextModule,
    ]);

    // mock used instance
    injector.overrideProviders(
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: AppConfig,
        useValue: {},
      },
      {
        token: StorageProvider,
        useValue: MockedStorageProvider,
      },
      {
        token: IThemeService,
        useValue: {
          onThemeChange: () => Disposable.create(() => {}),
        },
      },
      {
        token: IDecorationsService,
        useValue: {
          onDidChangeDecorations:  () => Disposable.create(() => {}),
        },
      },
      {
        token: 'FileServiceOptions',
        useValue: FileSystemNodeOptions.DEFAULT,
      },
      {
        token: FileServicePath,
        useClass: FileService,
      },
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
      },
    );

    // use root path as workspace path
    injector.mock(IWorkspaceService, 'workspace', {
      uri: root.toString(),
      isDirectory: true,
    } as FileStat);

    fileTreeModelService = injector.get(FileTreeModelService);

    await fileTreeModelService.whenReady;

    // 确保数据初始化完毕，减少初始化数据过程中多次刷新视图
    // 这里需要重新取一下treeModel的值确保为最新的TreeModel
    await fileTreeModelService.treeModel.root.ensureLoaded;

    done();
  });

  afterEach(async (done) => {
    injector.disposeAll();
    track.cleanupSync();
    done();
  });

  describe('01 #Init', () => {
    it('should have enough API', async (done) => {
      expect(!!fileTreeModelService.treeModel.root).toBeTruthy();
      done();
    });
  });

  // describe('02 #API should be worked.', () => {

  //   it('init', async (done) => {

  //   });

  //   it('can get symbolic or unsymbolic file with correct statusKey', async (done) => {
  //     done();
  //   });

  //   it('getParent and getChildren should be work', () => {
  //   });

  //   it('createFile and createFolder should be work', async (done) => {
  //   });

  //   it('removeStatusAndFileFromParent should be work', () => {
  //   });

  //   it('can create/remove template file or folder', () => {
  //   });

  //   it('can covert a file to template file', () => {
  //   });

  //   it('can rename file', async (done) => {
  //   });

  //   it('delete file should be work', async (done) => {
  //   });

  //   it('comfirm view should be work while explorer.confirmMove === true', async (done) => {
  //   });

  //   it('comfirm view should be work while explorer.confirmDelete === true', async (done) => {
  //   });

  //   it('update/reset file selected status should be work', () => {
  //   });

  //   it('can collapse all item without params', async (done) => {
  //   });

  //   it('can collapse all item with params', async (done) => {
  //   });

  //   it('refresh should be work', async (done) => {
  //   });

  //   it('update files expended status by queue should be work', async (done) => {
  //   });

  //   it('should open file with preview mode while editor.previewMode === true', () => {
  //   });
  // });

  // it('open file with fixed should be work', () => {
  // });

  // it('open file to the side should be work', () => {
  // });

  // it('comare file should be work', () => {
  // });

  // it('copy/cut/paste file should be work', () => {
  // });

});
