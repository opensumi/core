import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileUri, URI, IFileServiceClient, Disposable, StorageProvider } from '@ali/ide-core-common';
import { FileTreeNextModule } from '../../src';
import { FileTreeService } from '../../src/browser/file-tree.service';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { IWorkspaceService } from '@ali/ide-workspace';
import { FileStat, FileServicePath } from '@ali/ide-file-service';
import { FileTreeModelService } from '../../src/browser/services/file-tree-model.service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileSystemNodeOptions, FileService } from '@ali/ide-file-service/lib/node';
import { AppConfig, INodeLogger } from '@ali/ide-core-node';
import { IDecorationsService } from '@ali/ide-decoration';
import { IThemeService } from '@ali/ide-theme';
import { MockedStorageProvider } from '@ali/ide-core-browser/lib/mocks/storage';
import { Directory, File } from '@ali/ide-file-tree-next/lib/browser/file-tree-nodes';
import { TreeNodeType } from '@ali/ide-components';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IDialogService } from '@ali/ide-overlay';
import { IContextKeyService, CorePreferences, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import * as styles from '../browser/file-tree-node.module.less';
import { FileDecorationsService } from '@ali/ide-decoration/lib/browser/decorationsService';
import { SymlinkDecorationsProvider } from '../../src/browser/symlink-file-decoration';

describe('FileTree should be work while on single workspace model', () => {
  let track;
  let injector: MockInjector;
  let root: URI;
  let fileTreeModelService: FileTreeModelService;
  let filesMap;
  let fileTreeService: FileTreeService;

  beforeAll(async (done) => {
    track = temp.track();
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('file-tree-next-test')));
    filesMap = [
      {
        path: root.resolve('test.js').withoutScheme().toString(),
        type: 'file',
      },
      {
        path: root.resolve('test').withoutScheme().toString(),
        type: 'directory',
      },
      {
        path: root.resolve('test.json').withoutScheme().toString(),
        type: 'file',
      },
    ];
    for (const file of filesMap) {
      if (file.type === 'directory') {
        await fs.ensureDir(file.path);
      } else {
        await fs.ensureFile(file.path);
      }
    }
    done();
  });

  afterAll(() => {
    track.cleanupSync();
  });

  beforeEach(async (done) => {
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
        token: CorePreferences,
        useValue: {
          'workbench.list.openMode': 'singleClick',
          'editor.previewMode': true,
        },
      },
      {
        token: INodeLogger,
        useValue: {
          debug: () => {},
        },
      },
      {
        token: StorageProvider,
        useValue: MockedStorageProvider,
      },
      {
        token: IContextKeyService,
        useClass: MockContextKeyService,
      },
      {
        token: IDialogService,
        useValue: {
          warning: () => {},
        },
      },
      {
        token: IThemeService,
        useValue: {
          onThemeChange: () => Disposable.create(() => {}),
        },
      },
      {
        token: IDecorationsService,
        useClass: FileDecorationsService,
      },
      {
        token: IFileServiceClient,
        useClass: FileServiceClient,
      },
    );
    const fileService = injector.get(FileService, [ FileSystemNodeOptions.DEFAULT, {
      info: () => {},
      error: () => {},
    }]);
    injector.overrideProviders({
      token: FileServicePath,
      useValue: fileService,
    });
    // use root path as workspace path
    injector.mock(IWorkspaceService, 'workspace', {
      uri: root.toString(),
      isDirectory: true,
    } as FileStat);
    injector.mock(IWorkspaceService, 'isMutiWorkspace', false);
    injector.mock(IWorkspaceService, 'roots', [{
      uri: root.toString(),
      isDirectory: true,
    } as FileStat]);

    injector.mock(FileTreeModelService, 'fileTreeHandle', {
      hasDirectFocus: () => false,
      promptNewTreeNode: (() => {}) as any,
      promptNewCompositeTreeNode: (() => {}) as any,
      promptRename: (() => {}) as any,
      expandNode: (() => {}) as any,
      collapseNode: (() => {}) as any,
      ensureVisible: (() => {}) as any,
      getModel: (() => {}) as any,
      onDidChangeModel: (() => {}) as any,
      onDidUpdate: (() => {}) as any,
    });

    fileTreeModelService = injector.get(FileTreeModelService);
    // wait for init fileTree model
    await fileTreeModelService.whenReady;
    // make sure the root has been loaded
    await fileTreeModelService.treeModel.root.ensureLoaded();

    fileTreeService = injector.get<FileTreeService>(FileTreeService);

    done();
  });

  afterEach(async (done) => {
    injector.disposeAll();
    done();
  });

  describe('01 #Init', () => {
    it('Root node should have correct property', () => {
      const rootNode = fileTreeModelService.treeModel.root;
      expect(!!rootNode).toBeTruthy();
      expect((rootNode as Directory).branchSize).toBe(filesMap.length);
      expect(rootNode.depth).toBe(0);
    });

    it('Directory and File should be sort correctly', () => {
      const rootNode = fileTreeModelService.treeModel.root;
      expect(rootNode.getTreeNodeAtIndex(0)?.type).toBe(TreeNodeType.CompositeTreeNode);
      expect(rootNode.getTreeNodeAtIndex(1)?.type).toBe(TreeNodeType.TreeNode);
      expect(rootNode.getTreeNodeAtIndex(2)?.type).toBe(TreeNodeType.TreeNode);
    });
  });

  describe('02 ##API should be worked', () => {
    it('Expand and collapse Directory should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      fs.ensureDirSync(directoryNode.uri.resolve('child_file').withoutScheme().toString());
      await directoryNode.setExpanded(true);
      expect(directoryNode.expanded).toBeTruthy();
      expect(rootNode.branchSize).toBe(filesMap.length + 1);
      await directoryNode.setCollapsed();
      expect(directoryNode.expanded).toBeFalsy();
      expect(rootNode.branchSize).toBe(filesMap.length);
      await fs.remove(directoryNode.uri.resolve('child_file').withoutScheme().toString());
      done();
    });

    it('Symbolic file should be create with correct decoration and file stat', async (done) => {
      // cause the contribution do not work while testing
      // we should register symlinkDecorationProvider on this case
      const symlinkDecorationsProvider = injector.get(SymlinkDecorationsProvider, [fileTreeService]);
      const decorationService = injector.get(IDecorationsService);
      decorationService.registerDecorationsProvider(symlinkDecorationsProvider);
      // create symlink file
      await fs.ensureSymlink(filesMap[1].path, root.resolve('0_symbolic_file').withoutScheme().toString());
      await fileTreeService.refresh();
      fileTreeService.onNodeRefreshed(() => {
        const rootNode = fileTreeModelService.treeModel.root;
        const symbolicNode = rootNode.children?.find((child: File) => child.filestat.isSymbolicLink) as File;
        const decoration = decorationService.getDecoration(symbolicNode.uri, symbolicNode.filestat.isDirectory);
        expect(rootNode.branchSize).toBe(filesMap.length + 1);
        expect(decoration.color).toBe('gitDecoration.ignoredResourceForeground');
        expect(decoration.badge).toBe('⤷');
        done();
      });
    });

    it('Style decoration should be right while click the item', async (done) => {
      const { handleItemClick, decorations } = fileTreeModelService;
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      const openFile = jest.fn();
      // first, click directory item
      handleItemClick(directoryNode, TreeNodeType.CompositeTreeNode);
      const dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      // second, click normal file
      const fileNode = rootNode.getTreeNodeAtIndex(1) as Directory;
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openFile);
      handleItemClick(fileNode, TreeNodeType.TreeNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      expect(openFile).toBeCalledWith(fileNode.uri, { disableNavigate: true, preview: true });
      done();
    });

  });
});
