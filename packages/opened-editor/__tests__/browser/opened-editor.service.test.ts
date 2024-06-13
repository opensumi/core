import cls from 'classnames';

import { TreeNodeType } from '@opensumi/ide-components';
import { EDITOR_COMMANDS, Emitter, IEventBus, URI, sleep } from '@opensumi/ide-core-browser';
import { IDecorationsService } from '@opensumi/ide-decoration';
import { FileDecorationsService } from '@opensumi/ide-decoration/lib/browser/decorationsService';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { IResource, ResourceDecorationChangeEvent, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService, ResourceService } from '@opensumi/ide-editor/lib/browser';
import { MockWorkbenchEditorService } from '@opensumi/ide-editor/lib/common/mocks/workbench-editor.service';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IThemeService } from '@opensumi/ide-theme';
import { MockThemeService } from '@opensumi/ide-theme/lib/common/mocks/theme.service';
import { IWorkspaceService } from '@opensumi/ide-workspace';
import { MockWorkspaceService } from '@opensumi/ide-workspace/lib/common/mocks';

import { OpenedEditorModule } from '../../src/browser';
import { EditorFile, OpenedEditorData } from '../../src/browser/opened-editor-node.define';
import { OpenedEditorModelService } from '../../src/browser/services/opened-editor-model.service';
import { OpenedEditorService } from '../../src/browser/services/opened-editor-tree.service';
import styles from '../src/browser/opened-editor-node.module.less';

describe('OpenedEditorModelService should be work', () => {
  let openedEditorModelService: OpenedEditorModelService;
  let openedEditorService: OpenedEditorService;
  let injector: MockInjector;
  const testFileUri = URI.file('/userhome/test.js');

  const fakeSetBadge = jest.fn();
  const fakeUpdateViewBadge = jest.fn();

  const fakeGetTabbarHandler = jest.fn();
  const fakeGetAccordionService = jest.fn();
  fakeGetTabbarHandler.mockReturnValue({
    setBadge: fakeSetBadge,
  });
  fakeGetAccordionService.mockReturnValue({
    updateViewBadge: fakeUpdateViewBadge,
  });

  const MockResourceService = {
    getResourceDecoration: () => ({ dirty: true }),
  };

  beforeEach(async () => {
    injector = createBrowserInjector([OpenedEditorModule]);

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
          getAccordionService: fakeGetAccordionService,
        },
      },
      {
        token: IEditorDocumentModelService,
        useValue: {
          getModelReference: jest.fn(() => ({
            instance: {
              dirty: false,
            },
            dispose: () => {},
          })),
        },
      },
    );
    const mockLoadingEmitter = new Emitter<IResource>();
    const baseMockGroup = {
      onDidEditorGroupContentLoading: mockLoadingEmitter.event,

      resourceStatus: new Map(),

      currentEditor: null,

      codeEditor: (() => {}) as any,

      diffEditor: (() => {}) as any,

      currentFocusedEditor: null,

      currentOrPreviousFocusedEditor: null,

      resources: [],

      currentResource: null,

      currentOpenType: null,

      open: (() => {}) as any,

      pin: (() => {}) as any,

      close: (() => {}) as any,

      getState: (() => {}) as any,

      restoreState: (() => {}) as any,

      saveAll: (() => {}) as any,

      closeAll: (() => {}) as any,

      saveCurrent: (() => {}) as any,

      saveResource: (() => {}) as any,
    };
    // 当editorGroup长度为1时
    // 取groups中的resource，
    // 大于1时，取groups为值
    const groups: OpenedEditorData[] = [
      {
        ...baseMockGroup,
        availableOpenTypes: [],
        changeOpenType: async () => {},
        index: 1,
        name: 'group 1',
        resources: [
          {
            name: testFileUri.displayName,
            uri: testFileUri,
            icon: '',
            metadata: {},
          },
        ],
        saveCurrent: async () => {},
        saveResource: async () => {},
      },
    ];
    injector.get(WorkbenchEditorService);
    injector.mock(WorkbenchEditorService, 'sortedEditorGroups', groups);
    openedEditorModelService = injector.get(OpenedEditorModelService);
    openedEditorService = injector.get(OpenedEditorService);
    await openedEditorModelService.whenReady;
    await openedEditorModelService.treeModel?.ensureReady;
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
    it('The tree data should no be empty', async () => {
      expect(openedEditorModelService.treeModel?.root.branchSize! > 0).toBeTruthy();
    });

    it('File should be dirty while file change', async () => {
      const eventBus = injector.get(IEventBus);
      eventBus.fire(
        new ResourceDecorationChangeEvent({
          uri: testFileUri,
          decoration: {
            dirty: true,
            readOnly: false,
          },
        }),
      );
      await sleep(1000);
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      expect((node as EditorFile).dirty).toBeTruthy();
    });

    it('Select file should be work', async () => {
      const openFile = jest.fn();
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      injector.mockCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, openFile);
      openedEditorModelService.handleItemClick(node as EditorFile, TreeNodeType.TreeNode);
      expect(openFile).toHaveBeenCalledTimes(1);
      expect(openedEditorModelService.decorations.getDecorations(node as any)?.classlist.join(' ')).toBe(
        cls(styles.mod_selected, styles.mod_focused),
      );
    });

    it('Close file should be work', async () => {
      const closeFile = jest.fn();
      const node = openedEditorService.getEditorNodeByUri(testFileUri);
      injector.mockCommand(EDITOR_COMMANDS.CLOSE.id, closeFile);
      openedEditorModelService.closeFile(node as EditorFile);
      expect(closeFile).toHaveBeenCalledTimes(1);
    });
  });
});
