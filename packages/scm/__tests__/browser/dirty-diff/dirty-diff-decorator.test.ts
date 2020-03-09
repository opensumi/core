import { URI } from '@ali/ide-core-common';
import { OverviewRulerLane, IDocPersistentCacheProvider } from '@ali/ide-editor';
import { EditorDocumentModel } from '@ali/ide-editor/src/browser/doc-model/main';
import { EmptyDocCacheImpl } from '@ali/ide-editor/src/browser';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';

import { SCMPreferences } from '../../../src/browser/scm-preference';
import { DirtyDiffDecorator } from '../../../src/browser/dirty-diff/dirty-diff-decorator';
import { DirtyDiffModel } from '../../../src/browser/dirty-diff/dirty-diff-model';

(global as any).monaco = createMockedMonaco();

describe('test for packages/scm/src/browser/scm-activity.ts', () => {
  describe('test for DirtyDiffDecorator', () => {
    let injector: MockInjector;
    let editorModel: monaco.editor.ITextModel;

    const fakeSetBadge = jest.fn();
    const fakeGetTabbarHandler = jest.fn();
    fakeGetTabbarHandler.mockReturnValue({
      setBadge: fakeSetBadge,
    });

    beforeEach(() => {
      injector = createBrowserInjector([], new MockInjector([
        {
          token: IDocPersistentCacheProvider,
          useClass: EmptyDocCacheImpl,
        },
        {
          token: SCMPreferences,
          useValue: {
            'scm.diffDecorations': 'all',
          },
        },
      ]));

      editorModel = injector.get(EditorDocumentModel, [
        URI.file('/test/workspace/abc.ts'),
        'test',
      ]).getMonacoModel();
    });

    afterEach(() => {
      fakeSetBadge.mockReset();
    });

    it('ok for no repo', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const dirtyDiffDecorator = injector.get(DirtyDiffDecorator, [editorModel, dirtyDiffModel]);

      const spy = jest.spyOn(editorModel, 'deltaDecorations');

      const change0 = {
        originalEndLineNumber: 0,
        originalStartLineNumber: 10,
        modifiedStartLineNumber: 111,
        modifiedEndLineNumber: 0,
      };
      dirtyDiffModel['_changes'] = [change0];
      dirtyDiffModel['_onDidChange'].fire([{
        start: 0,
        deleteCount: 0,
        toInsert: [change0],
      }]);

      expect(spy).toHaveBeenCalledTimes(1);
      const decos = spy.mock.calls[0][1];
      expect(decos.length).toBe(1);
      expect(decos[0].range).toEqual({
        startLineNumber: 111, startColumn: 1,
        endLineNumber: 111, endColumn: 1,
      });
      expect(decos[0].options.linesDecorationsClassName).toBe('dirty-diff-glyph dirty-diff-added');
      expect(decos[0].options.overviewRuler!.position).toBe(OverviewRulerLane.Left);

      expect(dirtyDiffDecorator['decorations'].length).toEqual(1);

      spy.mockRestore();
    });
  });
});
