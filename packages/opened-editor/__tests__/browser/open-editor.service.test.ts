import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { ExplorerOpenedEditorService } from '@ali/ide-opened-editor/lib/browser/explorer-opened-editor.service';
import { IWorkspaceService } from '@ali/ide-workspace';
import { MockWorkspaceService } from '@ali/ide-workspace/lib/common/mocks';
import { WorkbenchEditorService, ResourceDecorationChangeEvent } from '@ali/ide-editor';
import { MockWorkbenchEditorService } from '@ali/ide-editor/lib/common/mocks/workbench-editor.service';
import { IDecorationsService } from '@ali/ide-decoration';
import { OpenedEditorModule } from '../../lib/browser';
import { FileDecorationsService } from '@ali/ide-decoration/lib/browser/decorationsService';
import { OpenedEditorData } from '@ali/ide-opened-editor/lib/browser/opened-editor.service';
import { URI, IEventBus } from '@ali/ide-core-common';
import { IThemeService } from '@ali/ide-theme';
import { MockThemeService } from '@ali/ide-theme/lib/common/mocks/theme.service';
import { EDITOR_COMMANDS } from '@ali/ide-core-browser';

describe('ExplorerOpenedEditorService should be work', () => {
  let openEditorService: ExplorerOpenedEditorService;
  let injector: MockInjector;
  const testFileUri = new URI('file://test0.js');
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
        token: IDecorationsService,
        useClass: FileDecorationsService,
      },
      {
        token: IThemeService,
        useClass: MockThemeService,
      },
      {
        token: ExplorerOpenedEditorService,
        useClass: ExplorerOpenedEditorService,
      },

    );
    const baseMockGroup = {

      currentEditor: null,

      codeEditor: (() => {}) as any,

      currentFocusedEditor: undefined,

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
          name: 'test',
          uri: testFileUri,
          icon: '',
          metadata: {},
        }],
      },
    ];
    injector.get(WorkbenchEditorService);
    injector.mock(WorkbenchEditorService, 'editorGroups', groups);
    injector.mock(WorkbenchEditorService, 'onActiveResourceChange', () => {});
    openEditorService = injector.get(ExplorerOpenedEditorService);
    await openEditorService.init();
    done();
  });

  describe('01 #Init', () => {
    it('should have enough API', async () => {
      expect(typeof openEditorService.overrideFileDecorationService).toBe('object');
      expect(typeof openEditorService.overrideFileDecorationService.getDecoration).toBe('function');
      expect(typeof openEditorService.getTreeDatas).toBe('function');
      expect(typeof openEditorService.updateDecorations).toBe('function');
      expect(typeof openEditorService.resetFocused).toBe('function');
      expect(typeof openEditorService.resetStatus).toBe('function');
      expect(typeof openEditorService.updateSelected).toBe('function');
      expect(typeof openEditorService.updateStatus).toBe('function');
      expect(typeof openEditorService.onSelect).toBe('function');
      expect(typeof openEditorService.onContextMenu).toBe('function');
      expect(typeof openEditorService.getStatusKey).toBe('function');
      expect(typeof openEditorService.closeFile).toBe('function');
      expect(typeof openEditorService.clearStatus).toBe('function');
      expect(typeof openEditorService.commandActuator).toBe('function');
      expect(typeof openEditorService.closeByGroupId).toBe('function');
      expect(typeof openEditorService.saveByGroupId).toBe('function');
    });
  });

  describe('02 #API should be worked.', () => {
    it('The tree data should no be empty', async (done) => {
      expect(openEditorService.nodes.length > 0).toBeTruthy();
      done();
    });

    it('Status should be dirty while file change', async (done) => {
      const eventBus = injector.get(IEventBus);
      eventBus.fire(new ResourceDecorationChangeEvent({
        uri: testFileUri,
        decoration: {
          dirty: true,
        },
      }));
      // ts-jest 测试无法获取less的样式对象，用status来做额外判断
      const node = openEditorService.nodes[0];
      const status = openEditorService.status.get(openEditorService.getStatusKey(node));
      expect(status?.dirty).toBeTruthy();
      done();
    });

    it('Select file should be work', async (done) => {
      const node = openEditorService.nodes[0];
      openEditorService.onSelect([node]);
      const status = openEditorService.status.get(openEditorService.getStatusKey(node));
      expect(status?.selected).toBeTruthy();
      expect(status?.focused).toBeTruthy();
      done();
    });

    it('Blur file should be work', async (done) => {
      const node = openEditorService.nodes[0];
      openEditorService.onSelect([node]);
      let status = openEditorService.status.get(openEditorService.getStatusKey(node));
      expect(status?.selected).toBeTruthy();
      expect(status?.focused).toBeTruthy();
      openEditorService.resetFocused();
      status = openEditorService.status.get(openEditorService.getStatusKey(node));
      expect(status?.selected).toBeTruthy();
      expect(status?.focused).toBeFalsy();
      done();
    });

    it('Close file should be work', async (done) => {
      const closeFile = jest.fn();
      const node = openEditorService.nodes[0];
      injector.mockCommand(EDITOR_COMMANDS.CLOSE.id, closeFile);
      openEditorService.closeFile(node);
      expect(closeFile).toBeCalledWith(node.uri);
      done();
    });
  });
});
