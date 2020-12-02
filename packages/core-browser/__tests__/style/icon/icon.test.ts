import { getExternalIcon } from '../../../src/style/icon/icon';

describe('packages/core-browser/src/style/icon/icon.ts', () => {
  it('should get correct icon class', () => {
    expect(getExternalIcon('sync')).toBe('codicon codicon-sync');
    expect(getExternalIcon('smiley-outline')).toBe('octicon octicon-smiley-outline');
    expect(getExternalIcon('smiley-outline', 'codicon', false)).toBe('codicon codicon-smiley-outline');
    expect(getExternalIcon('sync', 'octicon')).toBe('octicon octicon-sync');
  });
});
