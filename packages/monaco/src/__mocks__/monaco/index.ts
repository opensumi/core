import { createMockedMonacoEditorApi } from './editor';
import { MockedMonacoUri } from './common/uri';
import { createMockedMonacoLanguageApi } from './langauge';

export function createMockedMonaco(): Partial<typeof monaco> {
  return {
    editor: createMockedMonacoEditorApi(),
    languages: createMockedMonacoLanguageApi(),
    Uri: MockedMonacoUri as any,
  };
}

export function mockMonaco() {

}
