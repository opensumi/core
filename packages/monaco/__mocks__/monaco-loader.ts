import { createMockedMonaco } from './monaco';

export async function loadMonaco() {
  (global as any).monaco = createMockedMonaco();
}
