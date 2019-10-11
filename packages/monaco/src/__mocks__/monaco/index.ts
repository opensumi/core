import { createMockedMonacoEditorApi } from './editor';
import { MockedMonacoUri } from './common/uri';

export function createMockedMonaco(): Partial<typeof monaco> {
  return {
    editor: createMockedMonacoEditorApi(),
    Uri: MockedMonacoUri as any,
  };
}

export function mockMonaco() {

}
