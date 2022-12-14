import * as converter from '../../src/common/vscode/converter';
import * as types from '../../src/common/vscode/ext-types';

describe('extension interface converter', () => {
  it('can convert diagnostics', () => {
    const msg = 'test';
    const diagnostic = new types.Diagnostic(new types.Range(0, 0, 0, 0), msg);
    diagnostic.code = {
      target: types.Uri.parse('https://github.com'),
      value: 'GitHub',
    };
    const marker = converter.Diagnostic.toMarker(diagnostic);
    expect(marker.message).toEqual(msg);
    expect(marker.codeHref).toBeDefined();
  });
});
