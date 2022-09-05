import { Uri } from '@opensumi/ide-core-common';
import { IDiffComputationResult } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorker';

import { MockedMonacoUri } from './common/uri';
import { createMockedMonacoEditorApi } from './editor';
import { createMockedMonacoLanguageApi } from './language';
import { createMockedMonacoPositionApi } from './position';
import { createMockedMonacoRangeApi } from './range';

export function createMockedMonaco() {
  const mockEditor = createMockedMonacoEditorApi();

  return {
    editor: mockEditor,
    languages: createMockedMonacoLanguageApi(),
    Uri: MockedMonacoUri as any,
    Range: createMockedMonacoRangeApi(),
    Position: createMockedMonacoPositionApi(),
    /** -------------------------------- IMPORTANT @deprecated -------------------------------- */
    // modes: {
    //   // @ts-ignore
    //   SelectionRangeRegistry: {
    //     register(selector, provider) {
    //       // console.log('SelectionRangeRegistry noop');
    //       mockFeatureProviderRegistry.set('registerSelectionRangeProvider', provider);
    //     },
    //   },
    // },
    // textModel: createMockedMonacoTextModelApi(),
    /** -------------------------------- IMPORTANT @deprecated -------------------------------- */
    // @ts-ignore
    services: {
      // @ts-ignore
      StaticServices: {
        modeService: {
          get: () => ({
            getOrCreateModeByFilenameOrFirstLine: (filename, firstLine) =>
              Promise.resolve({
                getId: () => {},
                getLanguageIdentifier: () => {},
                getLanguageId: () => 'javascript',
              }),
            getModeIdByFilepathOrFirstLine: () => {},
          }),
        },
        modelService: {
          get: () => ({
            getModel: () => ({
              getModeId: () => 'typescript',
            }),
          }),
        },
        editorWorkerService: {
          get(): any {
            return {
              canComputeDiff: (original: Uri, modified: Uri): boolean => true,
              computeDiff: (
                original: MockedMonacoUri,
                modified: MockedMonacoUri,
                ignoreTrimWhitespace: boolean,
              ): Promise<IDiffComputationResult | null> => {
                const model = mockEditor.getModel(modified);
                if (!model) {
                  return Promise.resolve(null);
                }
                const oldValue = model['oldValue'];

                return Promise.resolve({
                  identical: false,
                  quitEarly: true,
                  changes: [[1, 5, 0, model.getValue().length - oldValue.length, [[0, 0, 0, 0, 0, 0, 0, 0]]]],
                });
              },
            };
          },
        },
      },
    },
  };
}

export function mockMonaco() {}
