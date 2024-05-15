import { MarkerSeverity, Uri } from '@opensumi/ide-core-common';

import { reviveMarker } from '../../../src/browser/language/language.service';
describe('browser/language/language.service', () => {
  const testUri = Uri.parse('https://opensumi.com');
  const rawMarker = {
    code: '1234',
    message: 'hello',
    startLineNumber: 4,
    startColumn: 4,
    endLineNumber: 4,
    endColumn: 4,
    severity: MarkerSeverity.Hint,
  };
  const rawMarkerWithCodeHref = {
    code: '1234',
    codeHref: testUri,
    message: 'hello',
    startLineNumber: 4,
    startColumn: 4,
    endLineNumber: 4,
    endColumn: 4,
    severity: MarkerSeverity.Hint,
  };
  it('can revive marker to Diagnostic', () => {
    const diagnostic = reviveMarker(rawMarker);
    expect(diagnostic.code).toEqual(rawMarker.code);
    expect(diagnostic.range.start.line).toEqual(rawMarker.startLineNumber - 1);
    expect(diagnostic.range.start.character).toEqual(rawMarker.startColumn - 1);
    expect(diagnostic.range.end.line).toEqual(rawMarker.endLineNumber - 1);
    expect(diagnostic.range.end.character).toEqual(rawMarker.endColumn - 1);
  });
  it('can revive marker(with codeHref) to Diagnostic', () => {
    const diagnostic = reviveMarker(rawMarkerWithCodeHref);
    expect((diagnostic.code as any).value).toEqual(rawMarkerWithCodeHref.code);
    expect((diagnostic.code as any).target).toEqual(rawMarkerWithCodeHref.codeHref.codeUri);
    expect(diagnostic.range.start.line).toEqual(rawMarkerWithCodeHref.startLineNumber - 1);
    expect(diagnostic.range.start.character).toEqual(rawMarkerWithCodeHref.startColumn - 1);
    expect(diagnostic.range.end.line).toEqual(rawMarkerWithCodeHref.endLineNumber - 1);
    expect(diagnostic.range.end.character).toEqual(rawMarkerWithCodeHref.endColumn - 1);
  });
});
