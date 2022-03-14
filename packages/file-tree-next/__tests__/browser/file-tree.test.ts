import path from 'path';

import * as fs from 'fs-extra';
import temp from 'temp';

import { TreeNodeEvent, TreeNodeType } from '@opensumi/ide-components';
import { IContextKeyService, CorePreferences, EDITOR_COMMANDS, PreferenceService } from '@opensumi/ide-core-browser';
import { MockContextKeyService } from '@opensumi/ide-core-browser/__mocks__/context-key';
import { MockedStorageProvider } from '@opensumi/ide-core-browser/__mocks__/storage';
import {
  FileUri,
  URI,
  Disposable,
  StorageProvider,
  IApplicationService,
  isWindows,
  isLinux,
  OS,
} from '@opensumi/ide-core-common';
import { AppConfig, INodeLogger } from '@opensumi/ide-core-node';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { FileDecorationsService } from '@opensumi/ide-decoration/lib/browser/decorationsService';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { FileStat, FileServicePath, IDiskFileProvider, IFileServiceClient } from '@opensumi/ide-file-service';
import { FileServiceClient } from '@opensumi/ide-file-service/lib/browser/file-service-client';
import { FileSystemNodeOptions, FileService } from '@opensumi/ide-file-service/lib/node';
import { DiskFileSystemProvider } from '@opensumi/ide-file-service/lib/node/disk-file-system.provider';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IThemeService } from '@opensumi/ide-theme';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { FileTreeNextModule } from '../../src';
import { PasteTypes } from '../../src';
import { FileTreeContribution } from '../../src/browser/file-tree-contribution';
import styles from '../../src/browser/file-tree-node.module.less';
import { FileTreeService } from '../../src/browser/file-tree.service';
import { FileTreeModelService } from '../../src/browser/services/file-tree-model.service';
import { IFileTreeAPI, IFileTreeService } from '../../src/common';
import { Directory, File } from '../../src/common/file-tree-node.define';


function sleep(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

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
      expandNode: jest.fn() as any,
      collapseNode: jest.fn() as any,
      ensureVisible: jest.fn() as any,
      getModel: (() => {}) as any,
      onDidChangeModel: (() => {}) as any,
      onDidUpdate: (() => {}) as any,
      getCurrentSize: () => ({
        width: 100,
        height: 500,
      }),
    };
    track = temp.track();
    root = FileUri.create(fs.realpathSync(temp.mkdirSync('file-tree-next-test')));
    filesMap = [
      {
        path: path.join(root.path.toString(), '1_test.ts'),
        type: 'file',
      },
      {
        path: path.join(root.path.toString(), 'test'),
        type: 'directory',
      },
      {
        path: path.join(root.path.toString(), '0_test.ts'),
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
    injector = createBrowserInjector([FileTreeNextModule]);

    // mock used instance
    injector.overrideProviders(
      {
        token: PreferenceService,
        useValue: {
          get: (key) => mockCorePreference[key],
        },
      },
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
        token: IApplicationService,
        useValue: {
          backendOS: isWindows ? OS.Type.Windows : isLinux ? OS.Type.Linux : OS.Type.OSX,
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
        token: IDiskFileProvider,
        useClass: DiskFileSystemProvider,
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkspaceService,
      },
    );
    const fileServiceClient: FileServiceClient = injector.get(IFileServiceClient);
    fileServiceClient.registerProvider('file', injector.get(IDiskFileProvider));

    const rawFileTreeApi = injector.get(IFileTreeAPI);
    rawFileTreeApi.mv = mockFileTreeApi.mv;
    rawFileTreeApi.copyFile = mockFileTreeApi.copyFile;
    // mv and copyFile function should be ignore
    injector.overrideProviders({
      token: IFileTreeAPI,
      useValue: rawFileTreeApi,
    });

    injector.mock(IContextKeyService, 'getContextValue', mockGetContextValue);
    const fileService = injector.get(FileService, [FileSystemNodeOptions.DEFAULT]);
    injector.overrideProviders({
      token: FileServicePath,
      useValue: fileService,
    });
    // use root path as workspace path
    injector.mock(IWorkspaceService, 'isMultipleWorkspace', false);
    const workspaceService = injector.get(IWorkspaceService);

    await workspaceService.setWorkspace({
      uri: root.toString(),
      isDirectory: true,
    } as FileStat);

    injector.mock(FileTreeModelService, 'fileTreeHandle', mockTreeHandle);

    fileTreeModelService = injector.get(FileTreeModelService);
    fileTreeModelService.initTreeModel();
    // wait for init fileTree model
    await fileTreeModelService.whenReady;
    // make sure the root has been loaded
    await fileTreeModelService.treeModel.root.ensureLoaded();

    fileTreeService = injector.get<FileTreeService>(IFileTreeService);

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
      fs.ensureDirSync(path.join(directoryNode.uri.path.toString(), 'child_file'));
      await directoryNode.setExpanded(true);
      expect(directoryNode.expanded).toBeTruthy();
      expect(rootNode.branchSize).toBe(filesMap.length + 1);
      await directoryNode.setCollapsed();
      expect(directoryNode.expanded).toBeFalsy();
      expect(rootNode.branchSize).toBe(filesMap.length);
      // clean effect
      await fs.remove(path.join(directoryNode.uri.path.toString(), 'child_file'));
      done();
    });

    it('Symbolic file should be create with correct decoration and file stat', async (done) => {
      // cause the contribution do not work while testing
      // we should register symlinkDecorationProvider on this case
      const fileTreeContribution = injector.get(FileTreeContribution);
      await fileTreeContribution.onDidStart();
      const decorationService = injector.get(IDecorationsService);
      // create symlink file
      await fs.ensureSymlink(filesMap[1].path, path.join(root.path.toString(), '0_symbolic_file'));
      const dispose = fileTreeService.onNodeRefreshed(async () => {
        const rootNode = fileTreeModelService.treeModel.root;
        const symbolicNode = rootNode.children?.find((child: File) => child.filestat.isSymbolicLink) as File;
        const decoration = await decorationService.getDecoration(symbolicNode.uri, symbolicNode.filestat.isDirectory);
        expect(rootNode.branchSize).toBe(filesMap.length + 1);
        expect(decoration.color).toBe('gitDecoration.ignoredResourceForeground');
        expect(decoration.badge).toBe('⤷');
        await fs.remove(path.join(root.path.toString(), '0_symbolic_file'));
        dispose.dispose();
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
      const { handleItemClick, handleItemToggleClick, handleItemRangeClick, decorations } = fileTreeModelService;
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      // first, file should be selected
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      let dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      // second, file should be unselected
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([]);
      // third, file should be selected again
      handleItemToggleClick(directoryNode, TreeNodeType.CompositeTreeNode);
      dirDecoration = decorations.getDecorations(directoryNode);
      expect(dirDecoration?.classlist).toEqual([styles.mod_selected, styles.mod_focused]);
      // testing range 0 -> 2 item
      handleItemClick(directoryNode, TreeNodeType.CompositeTreeNode);
      const fileNode = rootNode.getTreeNodeAtIndex(2) as Directory;
      handleItemRangeClick(fileNode, TreeNodeType.TreeNode);
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected]);
      expect(fileTreeModelService.selectedFiles.length).toBe(3);
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
      await sleep(500);
      expect(mockTreeHandle.ensureVisible).toBeCalledWith(
        await fileTreeService.getFileTreeNodePathByUri(fileNode.uri),
        'smart',
        true,
      );
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected]);
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
      await sleep(500);
      expect(mockTreeHandle.ensureVisible).toBeCalledWith(
        await fileTreeService.getFileTreeNodePathByUri(fileNode.uri),
        'smart',
        true,
      );
      const fileDecoration = decorations.getDecorations(fileNode);
      expect(fileDecoration?.classlist).toEqual([styles.mod_selected]);
      done();
    });

    it('Move to next file node should be work', () => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const fileNode = rootNode.getTreeNodeAtIndex(1) as File;
      const fileNode2 = rootNode.getTreeNodeAtIndex(2) as File;
      fileTreeModelService.activeFileFocusedDecoration(fileNode);
      expect(fileTreeModelService.focusedFile?.uri.toString()).toBe(fileNode.uri.toString());
      fileTreeModelService.moveToNext();
      expect(fileTreeModelService.contextMenuFile?.uri.toString()).toBe(fileNode2.uri.toString());
    });

    it('Move to prev file node should be work', () => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const fileNode = rootNode.getTreeNodeAtIndex(1) as File;
      const fileNode2 = rootNode.getTreeNodeAtIndex(2) as File;
      fileTreeModelService.activeFileFocusedDecoration(fileNode2);
      expect(fileTreeModelService.focusedFile?.uri.toString()).toBe(fileNode2.uri.toString());
      fileTreeModelService.moveToPrev();
      expect(fileTreeModelService.contextMenuFile?.uri.toString()).toBe(fileNode.uri.toString());
    });

    it('Expand current file node should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      if (directoryNode.expanded) {
        const dispose = directoryNode.watcher.on(TreeNodeEvent.DidChangeExpansionState, async () => {
          fileTreeModelService.activeFileFocusedDecoration(directoryNode);
          mockTreeHandle.expandNode.mockClear();
          await fileTreeModelService.expandCurrentFile();
          expect(mockTreeHandle.expandNode).toBeCalledTimes(1);
          dispose.dispose();
          done();
        });
        directoryNode.setCollapsed();
      } else {
        fileTreeModelService.activeFileFocusedDecoration(directoryNode);
        mockTreeHandle.expandNode.mockClear();
        await fileTreeModelService.expandCurrentFile();
        expect(mockTreeHandle.expandNode).toBeCalledTimes(1);
        done();
      }
    });

    it('Collapse current file node should be work', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      const dispose = directoryNode.watcher.on(TreeNodeEvent.DidChangeExpansionState, async () => {
        fileTreeModelService.activeFileFocusedDecoration(directoryNode);
        mockTreeHandle.collapseNode.mockClear();
        await fileTreeModelService.collapseCurrentFile();
        expect(mockTreeHandle.collapseNode).toBeCalledTimes(1);
        dispose.dispose();
        done();
      });
      directoryNode.setExpanded();
    });

    it('New File with root uri should be work', async (done) => {
      const promptHandle = {
        destroyed: false,
        onChange: jest.fn(),
        onCommit: jest.fn(),
        onBlur: jest.fn(),
        onFocus: jest.fn(),
        onDestroy: jest.fn(),
        onCancel: jest.fn(),
      };
      mockTreeHandle.promptNewTreeNode.mockResolvedValueOnce(promptHandle);
      await fileTreeModelService.newFilePrompt(root);
      expect(mockTreeHandle.promptNewTreeNode).toBeCalled();
      expect(promptHandle.onChange).toBeCalled();
      expect(promptHandle.onCommit).toBeCalled();
      expect(promptHandle.onBlur).toBeCalled();
      expect(promptHandle.onFocus).toBeCalled();
      expect(promptHandle.onDestroy).toBeCalled();
      expect(promptHandle.onCancel).toBeCalled();
      done();
    });

    it('New Directory with root uri should be work', async (done) => {
      const promptHandle = {
        destroyed: false,
        onChange: jest.fn(),
        onCommit: jest.fn(),
        onBlur: jest.fn(),
        onFocus: jest.fn(),
        onDestroy: jest.fn(),
        onCancel: jest.fn(),
      };
      mockTreeHandle.promptNewCompositeTreeNode.mockResolvedValueOnce(promptHandle);
      await fileTreeModelService.newDirectoryPrompt(root);
      expect(mockTreeHandle.promptNewCompositeTreeNode).toBeCalled();
      expect(promptHandle.onChange).toBeCalled();
      expect(promptHandle.onCommit).toBeCalled();
      expect(promptHandle.onBlur).toBeCalled();
      expect(promptHandle.onFocus).toBeCalled();
      expect(promptHandle.onDestroy).toBeCalled();
      expect(promptHandle.onCancel).toBeCalled();
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
        currentTarget: {
          addEventListener: jest.fn(),
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
        stopPropagation: jest.fn(),
      };
      dndService.handleDragEnter(mockEvent as any, fileNode);
      expect(mockEvent.preventDefault).toBeCalled();
      expect(mockEvent.stopPropagation).toBeCalled();
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
      expect(directoryDecoration?.classlist).toEqual([styles.mod_dragover]);
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
      expect(directoryDecoration?.classlist).toEqual([]);
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
      expect(directoryDecoration?.classlist).toEqual([]);
      done();
    });
  });

  describe('04 #Compact Mode should be work', () => {
    it('Directory should be compressed while it contain single file', async (done) => {
      const treeModel = fileTreeModelService.treeModel;
      const rootNode = treeModel.root;
      const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
      const testFile = path.join(directoryNode.uri.path.toString(), 'a/b');
      const preNodeName = directoryNode.name;
      mockGetContextValue.mockImplementation((key) => {
        if (key === 'explorerViewletCompressedFocus') {
          return false;
        }
        return true;
      });
      fileTreeService.isCompactMode = true;
      fs.ensureDirSync(testFile);
      const dispose = fileTreeService.onNodeRefreshed(async () => {
        const directoryNode = rootNode.getTreeNodeAtIndex(0) as Directory;
        expect(directoryNode.expanded).toBeTruthy();
        // cause the directory was compressed, branchSize will not increase
        expect(rootNode.branchSize).toBe(filesMap.length);
        expect(directoryNode.name).toBe(`${preNodeName}/a/b`);
        dispose.dispose();
        done();
      });
      await fileTreeService.refresh();
    });
  });
});
