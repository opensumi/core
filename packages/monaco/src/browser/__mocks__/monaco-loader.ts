import { createMockedMonaco } from '../../__mocks__/monaco';

export async function loadMonaco() {
  (global as any).monaco = createMockedMonaco();
}
