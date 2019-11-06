import { createMockedMonacoEditorApi } from './editor';
import { MockedMonacoUri } from './common/uri';
import { createMockedMonacoLanguageApi } from './langauge';
import { createMockedMonacoRamgeApi } from './range';

export function createMockedMonaco(): Partial<typeof monaco> {
  return {
    editor: createMockedMonacoEditorApi(),
    languages: createMockedMonacoLanguageApi(),
    Uri: MockedMonacoUri as any,
    Range: createMockedMonacoRamgeApi(),
  };
}

export function mockMonaco() {

}
