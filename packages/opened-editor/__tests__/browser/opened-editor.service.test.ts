import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { WorkbenchEditorService, ResourceDecorationChangeEvent, IResource } from '@ali/ide-editor';
import { MockWorkbenchEditorService } from '@ali/ide-editor/lib/common/mocks/workbench-editor.service';
import { IDecorationsService } from '@ali/ide-decoration';
import { OpenedEditorModule } from '../../src/browser';
import { FileDecorationsService } from '@ali/ide-decoration/lib/browser/decorationsService';
import { URI, IEventBus, Emitter } from '@ali/ide-core-common';
import { IThemeService } from '@ali/ide-theme';
import { MockThemeService } from '@ali/ide-theme/lib/common/mocks/theme.service';
import { EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IEditorDocumentModelService, ResourceService } from '@ali/ide-editor/lib/browser';
import { OpenedEditorModelService } from '@ali/ide-opened-editor/lib/browser/services/opened-editor-model.service';
import { OpenedEditorService } from '@ali/ide-opened-editor/lib/browser/services/opened-editor-tree.service';
import { TreeNodeType } from '@ali/ide-components';
import { EditorFile, OpenedEditorData } from '@ali/ide-opened-editor/lib/browser/opened-editor-node.define';
import cls from 'classnames';
import styles from '../src/browser/opened-editor-node.module.less';

describe('OpenedEditorModelService should be work', () => {
  let openedEditorModelService: OpenedEditorModelService;
  let openedEditorService: OpenedEditorService;
  let injector: MockInjector;
  const testFileUri = URI.file('/userhome/test.js');

  const fakeSetBadge = jest.fn();
  const fakeGetTabbarHandler = jest.fn();
  fakeGetTabbarHandler.mockReturnValue({
    setBadge: fakeSetBadge,
  });

  const MockResourceService = {
    getResourceDecoration: () => ({ dirty: true }),
  };

  beforeEach(async (done) => {
    injector = createBrowserInjector([
      OpenedEditorModule,
    ]);

    injector.addProviders(
      {
        token: IWorkspaceService,
        useClass: MockWorkspaceService,
      },
      {
        token: WorkbenchEditorService,
        useClass: MockWorkbenchEditorService,
      },
      {
        token: ResourceService,
        useValue: MockResourceService,
      },
      {
        token: IDecorationsService,
        useClass: FileDecorationsService,
      },
      {
        token: IThemeService,
        useClass: MockThemeService,
      },
      {
        token: IMainLayoutService,
        useValue: {
          getTabbarHandler: fakeGetTabbarHandler,
        },
      },
      {
        token: IEditorDocumentModelService,
        useValue: {
          getModelReference: jest.fn(() => ({
            instance: {
              dirty: false,
            },
            dispose: () => { },
          })),
        },
      },
    );
    const mockLoadingEmitter = new Emitter<IResource>();
    const baseMockGroup = {
      onDidEditorGroupContentLoading: mockLoadingEmitter.event,

      resourceStatus: new Map(),

      currentEditor: null,

      codeEditor: (() => { }) as any,

      diffEditor: (() => { }) as any,

      currentFocusedEditor: null,

      currentOrPreviousFocusedEditor: null,

      resources: [],

      currentResource: null,

      currentOpenType: null,

      open: (() => { }) as any,

      pin: (() => { }) as any,

      close: (() => { }) as any,

      getState: (() => { }) as any,

      restoreState: (() => { }) as any,

      saveAll: (() => { }) as any,

      closeAll: (() => { }) as any,

      saveCurrent: (() => { }) as any,

      saveResource: (() => { }) as any,
    };
    // 当editorGroup长度为1时
    // 取groups中的resource，
    // 大于1时，取groups为值
    const groups: OpenedEditorData[] = [
      {
        ...baseMockGroup,
        index: 1,
        name: 'group 1',
        resources: [{
          name: testFileUri.displayName,
          uri: testFileUri,
          icon: '',
          metadata: {},
        }],
        saveCurrent: async () => { },
        saveResource: async () => { },
      },
    ];
    injector.get(WorkbenchEditorService);
    injector.mock(WorkbenchEditorService, 'editorGroups', groups);
    openedEditorModelService = injector.get(OpenedEditorModelService);
    openedEditorService = injector.get(OpenedEditorService);
    await openedEditorModelService.whenReady;
    await openedEditorModelService.treeModel.root.ensureLoaded();
    done();
  });

  afterEach(() => {
    fakeSetBadge.mockReset();
  });

  describe('01 #Init', () => {
    it('should have enough API', async () => {
      expect(openedEditorModelService.commandService).toBeDefined();
      expect(openedEditorModelService.labelService).toBeDefined();
      expect(openedEditorModelService.decorationService).toBeDefined();
      expect(openedEditorModelService.decorations).toBeDefined();
      expect(openedEditorModelService.treeModel).toBeDefined();
      expect(Array.isArray(openedEditorModelService.focusedFile)).toBeFalsy();
      expect(Array.isArray(openedEditorModelService.selectedFiles)).toBeTruthy();
      expect(typeof openedEditorModelService.onDidRefreshed).toBe('function');
      expect(typeof openedEditorModelService.initDecorations).toBe('function');
      expect(typeof openedEditorModelService.activeFileDecoration).toBe('function');
      expect(typeof openedEditorModelService.enactiveFileDecoration).toBe('function');
      expect(typeof openedEditorModelService.removeFileDecoration).toBe('function');
      expect(typeof openedEditorModelService.handleContextMenu).toBe('function');
      expect(typeof openedEditorModelService.handleTreeHandler).toBe('function');
      expect(typeof openedEditorModelService.handleTreeBlur).toBe('function');
      expect(typeof openedEditorModelService.handleItemClick).toBe('function');
      expect(typeof openedEditorModelService.refresh).toBe('function');
      expect(typeof openedEditorModelService.flushEventQueue).toBe('function');
      expect(typeof openedEditorModelService.location).toBe('function');
      expect(typeof openedEditorModelService.openFile).toBe('function');
      expect(typeof openedEditorModelService.closeFile).toBe('function');
      expect(typeof openedEditorModelService.closeAllByGroup).toBe('function');
      expect(typeof openedEditorModelService.saveAllByGroup).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {
    it('The tree data should no be empty', async (done) => {
      expect(openedEditorModelService.treeModel.root.branchSize > 0).toBeTruthy();
      done();
    });

    it('File should be dirty while file change', async (done) => {
      const eventBus = injector.get(IEventBus);
      eventBus.fire(new ResourceDecorationChangeEvent({
        uri: testFileUri,
        decoration: {
          dirty: true,
        },
      }));
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      expect(openedEditorModelService.decorations.getDecorations(node as any)?.classlist.join(' ')).toBe(styles.mod_dirty);
      done();
    });

    it('Select file should be work', async (done) => {
      const openFile = jest.fn();
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openFile);
      openedEditorModelService.handleItemClick(node as EditorFile, TreeNodeType.TreeNode);
      expect(openFile).toBeCalledTimes(1);
      expect(openedEditorModelService.decorations.getDecorations(node as any)?.classlist.join(' ')).toBe(cls(styles.mod_dirty, styles.mod_selected, styles.mod_focused));
      done();
    });

    it('Close file should be work', async (done) => {
      const closeFile = jest.fn();
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      injector.mockCommand(EDITOR_COMMANDS.CLOSE.id, closeFile);
      openedEditorModelService.closeFile(node as EditorFile);
      expect(closeFile).toBeCalledTimes(1);
      done();
    });
  });
});
