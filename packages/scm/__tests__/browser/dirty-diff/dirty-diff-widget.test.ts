import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { positionToRange, URI, CommandService } from '@opensumi/ide-core-common';
import { IDocPersistentCacheProvider } from '@opensumi/ide-editor';
import { EmptyDocCacheImpl, IEditorDocumentModelService } from '@opensumi/ide-editor/src/browser';
import { IEditorDocumentModel } from '@opensumi/ide-editor/src/browser/';
import { EditorDocumentModel } from '@opensumi/ide-editor/src/browser/doc-model/main';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../../monaco/__mocks__/monaco';
import { SCMService } from '../../../src';
import { DirtyDiffModel } from '../../../src/browser/dirty-diff/dirty-diff-model';
import { DirtyDiffWidget } from '../../../src/browser/dirty-diff/dirty-diff-widget';

@Injectable()
class MockEditorDocumentModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  async createModelReference(uri: URI) {
    const instance = this.injector.get(EditorDocumentModel, [uri, 'test-content']);

    return { instance };
  }
}

const mockedMonaco = createMockedMonaco();

(global as any).monaco = mockedMonaco;

jest.useFakeTimers();

// mock ThrottledDelayer to take it easy in unit test
jest.mock('@opensumi/ide-core-common/src/async', () => ({
  ...jest.requireActual('@opensumi/ide-core-common/src/async'),
  ThrottledDelayer: class {
    constructor() {}
    trigger(value) {
      return Promise.resolve(value);
    }
  },
}));

describe('scm/src/browser/dirty-diff/dirty-diff-widget.ts', () => {
  describe('test for DirtyDiffDecorator', () => {
    let injector: MockInjector;
    let editorModel: IEditorDocumentModel;
    let commandService: CommandService;
    const fakeExecCmd = jest.fn();

    const codeEditor = mockedMonaco.editor!.create(document.createElement('div'));
    beforeEach(() => {
      injector = createBrowserInjector(
        [],
        new MockInjector([
          {
            token: IDocPersistentCacheProvider,
            useClass: EmptyDocCacheImpl,
          },
          {
            token: IEditorDocumentModelService,
            useClass: MockEditorDocumentModelService,
          },
          {
            token: CommandService,
            useValue: {
              executeCommand: fakeExecCmd,
            },
          },
          SCMService,
        ]),
      );

      editorModel = injector.get(EditorDocumentModel, [URI.file('/test/workspace/abc.ts'), 'test']);
      codeEditor.setModel(editorModel.getMonacoModel());

      commandService = injector.get(CommandService);
    });

    afterEach(() => {
      editorModel.dispose();
    });

    afterAll(() => {
      codeEditor.dispose();
    });

    it('ok for basic checking', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [codeEditor, dirtyDiffModel, commandService]);

      expect(dirtyDiffWidget.currentIndex).toBe(0);
      dirtyDiffWidget.updateCurrent(10);
      expect(dirtyDiffWidget.currentIndex).toBe(10);
    });

    it('ok for applyClass', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [codeEditor, dirtyDiffModel, commandService]);

      const changes = [
        {
          originalStartLineNumber: 11,
          originalEndLineNumber: 11,
          modifiedStartLineNumber: 11,
          modifiedEndLineNumber: 11,
        },
        {
          originalStartLineNumber: 12,
          originalEndLineNumber: 12,
          modifiedStartLineNumber: 12,
          modifiedEndLineNumber: 12,
        },
        {
          originalStartLineNumber: 14,
          originalEndLineNumber: 14,
          modifiedStartLineNumber: 14,
          modifiedEndLineNumber: 14,
        },
        {
          originalStartLineNumber: 15,
          originalEndLineNumber: 15,
          modifiedStartLineNumber: 15,
          modifiedEndLineNumber: 15,
        },
      ];
      dirtyDiffModel['_changes'] = changes;
      dirtyDiffWidget.updateCurrent(2);

      dirtyDiffWidget['applyClass']();

      const head = dirtyDiffWidget['_head'];
      expect(head.className).toBe('dirty-diff-widget-header');

      const wrapper = dirtyDiffWidget['_wrapper'];
      expect(wrapper.className).toBe('dirty-diff-widget-wrapper');

      const content = dirtyDiffWidget['_content'];
      expect(content.className).toBe('dirty-diff-widget-content');

      expect(dirtyDiffWidget.getContentNode()).toBe(content);

      const title = dirtyDiffWidget['_title'];
      expect(title.innerText).toBe('abc.ts');
      expect(title.className).toBe('file-name');
      expect(title.tagName).toBe('DIV');
      expect(title.parentNode).toBe(head);

      const actions = dirtyDiffWidget['_actions'];
      expect(actions.className).toBe('file-actions');
      expect(actions.parentNode).toBe(head);

      codeEditor.setModel(null);

      try {
        dirtyDiffWidget['applyClass']();
      } catch (err) {
        expect(err.message).toBe('Not found model');
      }

      codeEditor.setModel(editorModel.getMonacoModel());
    });

    it('ok for actions', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [codeEditor, dirtyDiffModel, commandService]);

      const fakeDispose = jest.fn();
      dirtyDiffWidget['dispose'] = fakeDispose;

      const changes = [
        {
          originalStartLineNumber: 11,
          originalEndLineNumber: 11,
          modifiedStartLineNumber: 11,
          modifiedEndLineNumber: 11,
        },
        {
          originalStartLineNumber: 12,
          originalEndLineNumber: 12,
          modifiedStartLineNumber: 12,
          modifiedEndLineNumber: 12,
        },
        {
          originalStartLineNumber: 14,
          originalEndLineNumber: 14,
          modifiedStartLineNumber: 14,
          modifiedEndLineNumber: 14,
        },
        {
          originalStartLineNumber: 15,
          originalEndLineNumber: 15,
          modifiedStartLineNumber: 15,
          modifiedEndLineNumber: 15,
        },
      ];
      dirtyDiffModel['_changes'] = changes;
      dirtyDiffWidget.updateCurrent(2);

      dirtyDiffWidget['_current'] = positionToRange(13);

      dirtyDiffWidget['applyClass']();

      const actions = dirtyDiffWidget['_actions'];
      expect(actions.className).toBe('file-actions');
      const actionList = Array.from(actions.children) as HTMLElement[];
      expect(actionList.length).toBe(5);
      expect(actionList.map((n) => n.className)).toEqual(
        ['plus', 'rollback', 'up', 'down', 'close'].map((n) => `kaitian-icon kticon-${n}`),
      );
      // onclick test

      // add
      actionList[0].click();
      expect(fakeExecCmd).toBeCalledTimes(1);
      expect(fakeExecCmd.mock.calls[0]).toEqual(['git.stageChange', URI.file('/test/workspace/abc.ts'), changes, 1]);
      expect(fakeDispose).toHaveBeenCalledTimes(1);

      // revert
      actionList[1].click();
      expect(fakeExecCmd).toBeCalledTimes(2);
      expect(fakeExecCmd.mock.calls[1]).toEqual(['git.revertChange', URI.file('/test/workspace/abc.ts'), changes, 1]);
      expect(fakeDispose).toHaveBeenCalledTimes(2);

      // next
      actionList[2].click();
      expect(fakeExecCmd).toBeCalledTimes(3);
      expect(fakeExecCmd.mock.calls[2]).toEqual(['OPEN_DIRTY_DIFF_WIDGET', 14]);

      // prev
      actionList[3].click();
      expect(fakeExecCmd).toBeCalledTimes(4);
      expect(fakeExecCmd.mock.calls[3]).toEqual(['OPEN_DIRTY_DIFF_WIDGET', 12]);

      // close
      actionList[4].click();
      expect(fakeExecCmd).toBeCalledTimes(4);
      expect(fakeDispose).toHaveBeenCalledTimes(3);

      dirtyDiffWidget['_current'] = positionToRange(14);
      dirtyDiffModel['findNextClosestChangeLineNumber'] = (n) => n;
      actionList[2].click();
      dirtyDiffModel['findPreviousClosestChangeLineNumber'] = (n) => n;
      actionList[3].click();
      expect(fakeExecCmd).toBeCalledTimes(4);
    });

    it('ok for applyStyle', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      dirtyDiffModel['_changes'] = [
        {
          originalStartLineNumber: 11,
          originalEndLineNumber: 11,
          modifiedStartLineNumber: 11,
          modifiedEndLineNumber: 11,
        },
        {
          originalStartLineNumber: 12,
          originalEndLineNumber: 12,
          modifiedStartLineNumber: 12,
          modifiedEndLineNumber: 12,
        },
        {
          originalStartLineNumber: 14,
          originalEndLineNumber: 14,
          modifiedStartLineNumber: 14,
          modifiedEndLineNumber: 14,
        },
        {
          originalStartLineNumber: 15,
          originalEndLineNumber: 15,
          modifiedStartLineNumber: 15,
          modifiedEndLineNumber: 15,
        },
      ];
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [codeEditor, dirtyDiffModel, commandService]);

      dirtyDiffWidget.updateCurrent(2);

      dirtyDiffWidget['applyClass']();
      dirtyDiffWidget['applyStyle']();

      const title = dirtyDiffWidget['_title'];
      expect(title.children.length).toBe(1);
      const detail = title.children[0];
      expect(detail.tagName).toBe('SPAN');
      expect(detail.className).toBe('dirty-diff-widget-title-detail');
      expect((detail as HTMLElement).innerText).toBe('第 2 个更改（共 4 个）');

      dirtyDiffWidget.updateCurrent(4);

      dirtyDiffWidget['applyStyle']();
      // 上一个 children[0] 已经被移除了
      expect((title.children[0] as HTMLElement).innerText).toBe('第 4 个更改（共 4 个）');
    });

    it('ok for relayout', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffWidget = injector.get(DirtyDiffWidget, [codeEditor, dirtyDiffModel, commandService]);

      const fakeRelayout = jest.fn();
      // store the real method
      const realRelayout = dirtyDiffWidget['_relayout'];
      dirtyDiffWidget['_relayout'] = fakeRelayout;

      dirtyDiffWidget.relayout(20);
      expect(fakeRelayout).toHaveBeenCalledTimes(1);
      expect(fakeRelayout).toHaveBeenCalledWith(20);
      // reset
      dirtyDiffWidget['_relayout'] = realRelayout;
    });
  });
});
