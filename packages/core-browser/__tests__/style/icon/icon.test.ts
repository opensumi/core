import { getCodIcon } from '../../../src/style/icon/icon';

describe('packages/core-browser/src/style/icon/icon.ts', () => {
  it('should get correct icon class', () => {
    expect(getCodIcon('sync')).toBe('codicon codicon-sync');
    expect(getCodIcon('smiley-outline')).toBe('octicon octicon-smiley-outline');
    expect(getCodIcon('smiley-outline', false)).toBe('codicon codicon-smiley-outline');
  });
});
