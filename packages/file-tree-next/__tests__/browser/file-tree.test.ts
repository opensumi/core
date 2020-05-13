import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { FileUri, URI, IFileServiceClient, Disposable, StorageProvider } from '@ali/ide-core-common';
import { FileTreeNextModule } from '../../src';
import { IFileTreeAPI } from '../../src/common';
import { FileTreeService } from '../../src/browser/file-tree.service';
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
import { Directory, File } from '../../src/browser/file-tree-nodes';
import { TreeNodeType } from '@ali/ide-components';
import { MockContextKeyService } from '@ali/ide-core-browser/lib/mocks/context-key';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { IContextKeyService, CorePreferences, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { FileDecorationsService } from '@ali/ide-decoration/lib/browser/decorationsService';
import { FileTreeContribution } from '../../src/browser/file-tree-contribution';
import { PasteTypes } from '../../src';
import { WorkbenchEditorService } from '@ali/ide-editor';
import * as temp from 'temp';
import * as fs from 'fs-extra';
import * as styles from '../../src/browser/file-tree-node.module.less';

describe('FileTree should be work while on single workspace model', () => {
  let track;
  let injector: MockInjector;
  let root: URI;
  let fileTreeModelService: FileTreeModelService;
  let filesMap;
  let fileTreeService: FileTreeService;
  let mockFileTreeApi;
  let mockTreeHandle;
  const mockGetContextValue = jest.fn();
  const mockCorePreference = {
    'workbench.list.openMode': 'singleClick',
    'editor.previewMode': true,
  };
  beforeAll(async (done) => {
    mockFileTreeApi = {
      mv: jest.fn(),
      copyFile: jest.fn(),
    };
    mockTreeHandle = {
      hasDirectFocus: () => false,
      promptNewTreeNode: jest.fn() as any,
      promptNewCompositeTreeNode: jest.fn() as any,
      promptRename: jest.fn() as any,
      expandNode: (() => {}) as any,
      collapseNode: (() => {}) as any,
      ensureVisible: jest.fn() as any,
      getModel: (() => {}) as any,
      onDidChangeModel: (() => {}) as any,
      onDidUpdate: (() => {}) as any,
    };
    track = temp.track();
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('file-tree-next-test')));
    filesMap = [
      {
        path: root.resolve('1_test.ts').withoutScheme().toString(),
        type: 'file',
      },
      {
        path: root.resolve('test').withoutScheme().toString(),
        type: 'directory',
      },
      {
        path: root.resolve('0_test.ts').withoutScheme().toString(),
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
        token: IMessageService,
        useValue: {
          error: () => {},
        },
      },
      {
        token: CorePreferences,
        useValue: mockCorePreference,
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
      {
        token: WorkbenchEditorService,
        useClass: MockWorkspaceService,
      },
    );

    const rawFileTreeApi = injector.get(IFileTreeAPI);
    rawFileTreeApi.mv = mockFileTreeApi.mv;
    rawFileTreeApi.copyFile = mockFileTreeApi.copyFile;
    // mv and copyFile function should be ignore
    injector.overrideProviders({
      token: IFileTreeAPI,
      useValue: rawFileTreeApi,
    });

    injector.mock(IContextKeyService, 'getContextValue', mockGetContextValue);
    const fileService = injector.get(FileService, [ FileSystemNodeOptions.DEFAULT, {
      info: () => {},
      error: () => {},
    }]);
    injector.overrideProviders({
      token: FileServicePath,
      useValue: fileService,
    });
    // use root path as workspace path
    injector.mock(IWorkspaceService, 'isMutiWorkspace', false);
    const workspaceService = injector.get(IWorkspaceService);

    await workspaceService.setWorkspace({
      uri: root.toString(),
      isDirectory: true,
    } as FileStat);

    injector.mock(FileTreeModelService, 'fileTreeHandle', mockTreeHandle);

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
  afterAll(() => {
    track.cleanupSync();
    mockTreeHandle.promptNewTreeNode.mockReset();
    mockTreeHandle.promptNewCompositeTreeNode.mockReset();
    mockTreeHandle.promptRename.mockReset();
    mockTreeHandle.ensureVisible.mockReset();
    mockFileTreeApi.mv.mockReset();
    mockFileTreeApi.copyFile.mockReset();
    mockGetContextValue.mockReset();
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

  describe('02 #Basic API should be worked', () => {
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
      // clean effect
      await fs.remove(directoryNode.uri.resolve('child_file').withoutScheme().toString());
      done();
    });

    it('Symbolic file should be create with correct decoration and file stat', async (done) => {
      // cause the contribution do not work while testing
      // we should register symlinkDecorationProvider on this case
      const fileTreeContribution = injector.get(FileTreeContribution);
      await fileTreeContribution.onDidStart();
      const decorationService = injector.get(IDecorationsService);
      // create symlink file
      await fs.ensureSymlink(filesMap[1].path, root.resolve('0_symbolic_file').withoutScheme().toString());
      fileTreeService.onNodeRefreshed(async () => {
        const rootNode = fileTreeModelService.treeModel.root;
        const symbolicNode = rootNode.children?.find((child: File) => child.filestat.isSymbolicLink) as File;
        const decoration = await decorationService.getDecoration(symbolicNode.uri, symbolicNode.filestat.isDirectory);
        expect(rootNode.branchSize).toBe(filesMap.length + 1);
        expect(decoration.color).toBe('gitDecoration.ignoredResourceForeground');
        expect(decoration.badge).toBe('⤷');
        await fs.remove(root.resolve('0_symbolic_file').withoutScheme().toString());
        done();
      });
      await fileTreeService.refresh();
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

    it('Style decoration should be right while click with ctrl/cmd/shift', async (done) => {
      const { handleItemClick, handleItemToggleClick, handleItemRangeClick, selectedFiles, decorations } = fileTreeModelService;
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      // first, file should be selected
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      let dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected]);
      // second, file should be focused
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      // third, file should be remove focused
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected]);
      // testing range 0 -> 2 item
      handleItemClick(directoryNode, TreeNodeType.CompositeTreeNode);
      const fileNode = rootNode.getTreeNodeAtIndex(2) as Directory;
      handleItemRangeClick(fileNode, TreeNodeType.TreeNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected]);
      expect(selectedFiles.length).toBe(2);
      done();
    });

    it('Cut - Paste should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { pasteFile, cutFile, decorations } = fileTreeModelService;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      // hard code, this node should be remove;
      const fileNode = rootNode.getTreeNodeAtIndex(2) as File;
      const selectedFiles = [fileNode.uri];
      // try to cut files
      await cutFile(selectedFiles);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_cut]);
      expect(fileTreeModelService.pasteStore.type).toBe(PasteTypes.CUT);
      // try to paste files while type is cut
      await pasteFile(directoryNode.uri);
      expect(directoryNode.expanded).toBeTruthy();
      expect(fileTreeModelService.pasteStore.type).toBe(PasteTypes.NONE);
      expect(mockFileTreeApi.mv).toBeCalled();
      done();
    });

    it('Copy - Paste should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { copyFile, pasteFile } = fileTreeModelService;
      // try to copy files
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      const fileNode = rootNode.getTreeNodeAtIndex(2) as File;
      const selectedFiles = [fileNode.uri];
      await copyFile(selectedFiles);
      expect(fileTreeModelService.pasteStore.type).toBe(PasteTypes.COPY);
      // try to paste files while type is copy
      await pasteFile(directoryNode.uri);
      expect(directoryNode.expanded).toBeTruthy();
      // paste type should be COPY after paste
      expect(fileTreeModelService.pasteStore.type).toBe(PasteTypes.COPY);
      expect(mockFileTreeApi.copyFile).toBeCalled();
      done();
    });

    it('Location file should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const fileNode = rootNode.getTreeNodeAtIndex(1) as File;
      const { location, decorations } = fileTreeModelService;
      mockTreeHandle.ensureVisible = jest.fn(() => fileNode);
      await location(fileNode.uri);
      expect(mockTreeHandle.ensureVisible).toBeCalledWith(fileNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      done();
    });

    it('Location file should be work while fileTree can be see', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const fileNode = rootNode.getTreeNodeAtIndex(1) as File;
      const { locationOnShow, performLocationOnHandleShow, decorations } = fileTreeModelService;
      mockTreeHandle.ensureVisible = jest.fn(() => fileNode);
      locationOnShow(fileNode.uri);
      await performLocationOnHandleShow();
      expect(mockTreeHandle.ensureVisible).toBeCalledWith(fileNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      done();
    });
  });

  describe('03 #DragAndDrop Service should be work', () => {
    it('Start Dragging with single selected node', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService, decorations } = fileTreeModelService;
      const fileNode = rootNode.getTreeNodeAtIndex(2) as File;
      expect(!!dndService.root).toBeTruthy();
      const mockEvent = {
        stopPropagation: jest.fn(),
        dataTransfer: {
          setDragImage: jest.fn(),
          setData: jest.fn(),
        },
      };
      dndService.handleDragStart(mockEvent as any, fileNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_dragging]);
      expect(mockEvent.stopPropagation).toBeCalled();
      expect(mockEvent.dataTransfer.setDragImage).toBeCalled();
      expect(mockEvent.dataTransfer.setData).toBeCalled();
      done();
    });

    it('Dragging Enter should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService } = fileTreeModelService;
      const fileNode = rootNode.getTreeNodeAtIndex(2) as File;
      const mockEvent = {
        preventDefault: jest.fn(),
      };
      dndService.handleDragEnter(mockEvent as any, fileNode);
      expect(mockEvent.preventDefault).toBeCalled();
      done();
    });

    it('Dragging Leave should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService } = fileTreeModelService;
      const fileNode = rootNode.getTreeNodeAtIndex(2) as File;
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      };
      dndService.handleDragLeave(mockEvent as any, fileNode);
      expect(mockEvent.stopPropagation).toBeCalled();
      expect(mockEvent.preventDefault).toBeCalled();
      done();
    });

    it('Dragging Over should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService, decorations } = fileTreeModelService;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as File;
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      };
      dndService.handleDragOver(mockEvent as any, directoryNode);
      expect(mockEvent.stopPropagation).toBeCalled();
      expect(mockEvent.preventDefault).toBeCalled();
      const directoryDecoration = decorations.getDecorations(directoryNode);
      // loading first, then dragover all the child
      expect(directoryDecoration?.classlist).toEqual([styles.mod_loading, styles.mod_dragover]);
      done();
    });

    it('Dragging End should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService, decorations } = fileTreeModelService;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as File;
      const mockEvent = {};
      dndService.handleDragEnd(mockEvent as any, directoryNode);
      const directoryDecoration = decorations.getDecorations(directoryNode);
      // loading decoration is effect by dragover
      expect(directoryDecoration?.classlist).toEqual([styles.mod_loading]);
      done();
    });

    it('Drop should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const { dndService, decorations } = fileTreeModelService;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as File;
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
        dataTransfer: {
          dropEffect: '',
        },
      };
      dndService.handleDrop(mockEvent as any, directoryNode);
      expect(mockEvent.stopPropagation).toBeCalled();
      expect(mockEvent.preventDefault).toBeCalled();
      expect(mockEvent.dataTransfer.dropEffect).toBe('copy');
      const directoryDecoration = decorations.getDecorations(directoryNode);
      // loading decoration is effect by dragover
      expect(directoryDecoration?.classlist).toEqual([styles.mod_loading]);
      done();
    });
  });

  describe('04 #Compact Mode should be work', () => {
    it('Directory should be compressed while it contain single file', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      const testFile = directoryNode.uri.resolve('a/b').withoutScheme().toString();
      const preNodeName = directoryNode.name;
      mockGetContextValue.mockImplementation((key) => {
        if (key === 'explorerViewletCompressedFocus') {
          return false;
        }
        return true;
      });
      fileTreeService.isCompactMode = true;
      fs.ensureDirSync(testFile);
      fileTreeService.onNodeRefreshed(async () => {
        const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
        expect(directoryNode.expanded).toBeTruthy();
        // cause the directory was compressed, branchSize will not increase
        expect(rootNode.branchSize).toBe(filesMap.length);
        expect(directoryNode.name).toBe(`${preNodeName}/a/b`);
        done();
      });
      await fileTreeService.refresh();
    });
  });
});
