import { createMockedMonacoEditorApi } from './editor';
import { MockedMonacoUri } from './common/uri';
import { createMockedMonacoLanguageApi, mockFeatureProviderRegistry } from './langauge';
import { createMockedMonacoRamgeApi } from './range';

export function createMockedMonaco(): Partial<typeof monaco> {
  return {
    editor: createMockedMonacoEditorApi(),
    languages: createMockedMonacoLanguageApi(),
    Uri: MockedMonacoUri as any,
    Range: createMockedMonacoRamgeApi(),
    modes: {
      // @ts-ignore
      SelectionRangeRegistry: {
        register(selector, provider) {
          console.log('SelectionRangeRegistry noop');
          mockFeatureProviderRegistry.set('registerSelectionRangeProvider', provider);
        },
      },
    },
  };
}

export function mockMonaco() {

}
