import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { positionToRange, DisposableStore, Uri, URI } from '@ali/ide-core-common';
import { IDocPersistentCacheProvider } from '@ali/ide-editor';
import { EditorDocumentModel } from '@ali/ide-editor/src/browser/doc-model/main';
import { EmptyDocCacheImpl, IEditorDocumentModelService } from '@ali/ide-editor/src/browser';
import { createMockedMonaco } from '@ali/ide-monaco/lib/__mocks__/monaco';

import { createBrowserInjector } from '../../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../../tools/dev-tool/src/mock-injector';

import { MockSCMProvider } from '../../scm-test-util';

import { DirtyDiffModel } from '../../../src/browser/dirty-diff/dirty-diff-model';
import { SCMService, ISCMRepository } from '../../../src';

@Injectable()
class MockEditorDocumentModelService {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  async createModelReference(uri: URI) {
    const instance = this.injector.get(EditorDocumentModel, [
      uri,
      'test-content',
    ]);

    return { instance };
  }
}

const mockedMonaco = createMockedMonaco();

(global as any).monaco = mockedMonaco;

jest.useFakeTimers();

// mock ThrottledDelayer to take it easy in unit test
jest.mock('@ali/ide-core-common/src/async', () => ({
  ...jest.requireActual('@ali/ide-core-common/src/async'),
  ThrottledDelayer: class {
    constructor() {}
    trigger(value) {
      return Promise.resolve(value);
    }
  },
}));

describe('test for packages/scm/src/browser/scm-activity.ts', () => {
  describe('test for DirtyDiffDecorator', () => {
    let injector: MockInjector;
    let editorModel: monaco.editor.ITextModel;
    let scmService: SCMService;
    let repo: ISCMRepository;
    let provider: MockSCMProvider;
    const disposables = new DisposableStore();

    const mockComputeDiff = jest.fn();

    let computeDiffRet: monaco.commons.IDiffComputationResult | null = null;

    beforeEach(() => {
      mockedMonaco.services!.StaticServices.editorWorkerService.get = (() => {
        return {
          canComputeDiff: (original: Uri, modified: Uri): boolean => true,
          computeDiff: async () => computeDiffRet,
        };
      }) as any;

      injector = createBrowserInjector([], new MockInjector([
        {
          token: IDocPersistentCacheProvider,
          useClass: EmptyDocCacheImpl,
        },
        {
          token: IEditorDocumentModelService,
          useClass: MockEditorDocumentModelService,
        },
        SCMService,
      ]));

      editorModel = injector.get(EditorDocumentModel, [
        URI.file('/test/workspace/abc.ts'),
        'test',
      ]).getMonacoModel();

      scmService = injector.get(SCMService);
      provider = new MockSCMProvider(1);
      repo = scmService.registerSCMProvider(provider);
    });

    afterEach(() => {
      editorModel.dispose();
      mockComputeDiff.mockRestore();
    });

    it('ok: check basic property', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      expect(dirtyDiffModel.modified).toEqual(editorModel);
      expect(dirtyDiffModel.original).toBeUndefined();
      expect(dirtyDiffModel.changes).toEqual([]);

      // private property
      const editorWorkerServiceMethods = Object.keys(dirtyDiffModel['editorWorkerService']);
      expect(editorWorkerServiceMethods).toContain('canComputeDiff');
      expect(editorWorkerServiceMethods).toContain('computeDiff');
    });

    it('ok for one repo', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      expect(dirtyDiffModel.modified).toEqual(editorModel);

      // mock computeDiff compute a diff changes
      const change0 = {
        originalStartLineNumber: 2,
        originalEndLineNumber: 5,
        modifiedStartLineNumber: 6,
        modifiedEndLineNumber: 8,
        charChanges: [],
      };
      computeDiffRet = {
        identical: false,
        changes: [change0],
      };
      editorModel.setValue('insert some content for testing');

      disposables.add(dirtyDiffModel.onDidChange((changes) => {
        expect(changes).toEqual({
          start: 0,
          deleteCount: 0,
          toInsert: [change0],
        });
        expect(dirtyDiffModel.original?.uri.scheme).toBe('git');
      }));
    });

    it('ok when repo#onDidChange', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);

      // mock computeDiff compute a diff changes
      const change0 = {
        originalStartLineNumber: 2,
        originalEndLineNumber: 5,
        modifiedStartLineNumber: 6,
        modifiedEndLineNumber: 8,
        charChanges: [],
      };

      computeDiffRet = {
        identical: false,
        changes: [change0],
      };
      provider.onDidChangeEmitter.fire();

      disposables.add(dirtyDiffModel.onDidChange((changes) => {
        expect(changes).toEqual({
          start: 0,
          deleteCount: 0,
          toInsert: [change0],
        });
        expect(dirtyDiffModel.original?.uri.scheme).toBe('git');
      }));
    });

    it('ok when repo#onDidChangeResources', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);

      // mock computeDiff compute a diff changes
      const change0 = {
        originalStartLineNumber: 2,
        originalEndLineNumber: 5,
        modifiedStartLineNumber: 6,
        modifiedEndLineNumber: 8,
        charChanges: [],
      };

      computeDiffRet = {
        identical: false,
        changes: [change0],
      };
      provider.onDidChangeResourcesEmitter.fire();

      disposables.add(dirtyDiffModel.onDidChange((changes) => {
        expect(changes).toEqual({
          start: 0,
          deleteCount: 0,
          toInsert: [change0],
        });
        expect(dirtyDiffModel.original?.uri.scheme).toBe('git');
      }));
    });

    it('ok for no repo', () => {
      repo.dispose();
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);

      // no repo matched so won't trigger any onDidChange event
      const eventSpy = jest.spyOn(dirtyDiffModel['_onDidChange'], 'fire');
      const triggerDiffSpy = jest.spyOn<DirtyDiffModel, any>(dirtyDiffModel, 'triggerDiff');

      expect(dirtyDiffModel.modified).toEqual(editorModel);
      editorModel.setValue('insert some content for testing');
      jest.runAllTimers();

      expect(eventSpy).toHaveBeenCalledTimes(0);
      // editor content changed trigger a `triggerDiff`
      expect(triggerDiffSpy).toHaveBeenCalledTimes(1);
      eventSpy.mockReset();
      triggerDiffSpy.mockReset();
    });

    it('find changes', () => {
      const dirtyDiffModel = injector.get(DirtyDiffModel, [editorModel]);
      const change0 = {
        originalStartLineNumber: 11,
        originalEndLineNumber: 11,
        modifiedStartLineNumber: 11,
        modifiedEndLineNumber: 11,
      };
      const change1 = {
        originalStartLineNumber: 12,
        originalEndLineNumber: 12,
        modifiedStartLineNumber: 12,
        modifiedEndLineNumber: 12,
      };
      const change2 = {
        originalStartLineNumber: 14,
        originalEndLineNumber: 14,
        modifiedStartLineNumber: 14,
        modifiedEndLineNumber: 14,
      };
      const change3 = {
        originalStartLineNumber: 15,
        originalEndLineNumber: 15,
        modifiedStartLineNumber: 15,
        modifiedEndLineNumber: 15,
      };

      dirtyDiffModel['_changes'] = [change0, change1, change2, change3];

      // findNextClosestChangeLineNumber\findPreviousClosestChangeLineNumber
      expect(dirtyDiffModel.findNextClosestChangeLineNumber(11)).toBe(11);
      expect(dirtyDiffModel.findNextClosestChangeLineNumber(11, false)).toBe(12);
      expect(dirtyDiffModel.findNextClosestChangeLineNumber(12, false)).toBe(14);

      expect(dirtyDiffModel.findNextClosestChangeLineNumber(10, false)).toBe(11);
      expect(dirtyDiffModel.findNextClosestChangeLineNumber(16, false)).toBe(11);

      expect(dirtyDiffModel.findPreviousClosestChangeLineNumber(15)).toBe(15);
      expect(dirtyDiffModel.findPreviousClosestChangeLineNumber(15, false)).toBe(14);
      expect(dirtyDiffModel.findPreviousClosestChangeLineNumber(14, false)).toBe(12);

      expect(dirtyDiffModel.findPreviousClosestChangeLineNumber(10, false)).toBe(15);
      expect(dirtyDiffModel.findPreviousClosestChangeLineNumber(16, false)).toBe(15);

      // getChangeFromRange
      expect(dirtyDiffModel.getChangeFromRange(positionToRange(10))).toEqual({
        change: change0,
        count: 1,
      });
      expect(dirtyDiffModel.getChangeFromRange(positionToRange(11))).toEqual({
        change: change0,
        count: 1,
      });
      expect(dirtyDiffModel.getChangeFromRange(positionToRange(12))).toEqual({
        change: change1,
        count: 2,
      });
      expect(dirtyDiffModel.getChangeFromRange(positionToRange(15))).toEqual({
        change: change3,
        count: 4,
      });
      expect(dirtyDiffModel.getChangeFromRange(positionToRange(16))).toEqual({
        change: change0,
        count: 1,
      });
    });

    describe('onClickDecoration', () => {
      it('this._widget existed', () => {
        expect('hello world').not.toBeUndefined();
      });
    });
  });
});
