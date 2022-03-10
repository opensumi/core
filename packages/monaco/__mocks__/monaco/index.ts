import { Uri } from '@opensumi/ide-core-common';
import { IDiffComputationResult } from '@opensumi/monaco-editor-core/esm/vs/editor/common/services/editorWorkerService';

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
                  changes: [
                    {
                      originalStartLineNumber: 1,
                      originalEndLineNumber: 5,
                      modifiedStartLineNumber: 0,
                      modifiedEndLineNumber: model.getValue().length - oldValue.length,
                      charChanges: [
                        {
                          modifiedEndColumn: 0,
                          modifiedEndLineNumber: 0,
                          modifiedStartColumn: 0,
                          modifiedStartLineNumber: 0,
                          originalEndColumn: 0,
                          originalEndLineNumber: 0,
                          originalStartColumn: 0,
                          originalStartLineNumber: 0,
                        },
                      ],
                    },
                  ],
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
