import { MockInjector } from '@opensumi/ide-dev-tool/src/mock-injector';
import { Uri } from '@opensumi/ide-utils';

import { IMarker, MarkerSeverity } from '../../../src';
import { MarkerManager } from '../../../src/types/markers/markers-manager';
import { getInjector } from '../../baseInjector';

describe('test for types/markers/markers-manager.ts', () => {
  let injector: MockInjector;
  const testUri = Uri.parse('https://opensumi.com');
  const editorUri = Uri.parse('file://users/test/index.html');
  const editorUri2 = Uri.parse('file://users/test/index2.html');
  const rawMarker = {
    code: '1234',
    codeHref: testUri,
    message: 'hello',
    startLineNumber: 4,
    startColumn: 4,
    endLineNumber: 4,
    endColumn: 4,
    severity: MarkerSeverity.Hint,
  };

  beforeEach(() => {
    injector = getInjector();
  });

  it('markers manager updateMarkers should work', (done) => {
    expect.assertions(10);
    const markerManager = injector.get(MarkerManager);

    markerManager.onMarkerChanged((uris) => {
      const uri = uris[0];
      expect(uri).toEqual(editorUri.toString());
      const markers = markerManager.getMarkers({
        resource: uri,
      });
      expect(markers.length).toEqual(1);
      expect(markers[0].code).toEqual(rawMarker.code);
      expect(markers[0].codeHref).toEqual(rawMarker.codeHref);
      expect(markers[0].message).toEqual(rawMarker.message);
      expect(markers[0].startColumn).toEqual(rawMarker.startColumn);
      expect(markers[0].startLineNumber).toEqual(rawMarker.startLineNumber);
      expect(markers[0].endLineNumber).toEqual(rawMarker.endLineNumber);
      expect(markers[0].endColumn).toEqual(rawMarker.endColumn);
      expect(markers[0].severity).toEqual(rawMarker.severity);
      done();
    });

    markerManager.updateMarkers('typescript', editorUri.toString(), [rawMarker]);
  });
  it('markers manager getMarkers filter should work', (done) => {
    expect.assertions(4);
    const markerManager = injector.get(MarkerManager);

    function testMarkersData(markers: IMarker[]) {
      expect(markers.length).toEqual(1);
    }
    markerManager.onMarkerChanged((uris) => {
      const uri = uris[0];
      expect(uri).toEqual(editorUri.toString());
      testMarkersData(
        markerManager.getMarkers({
          resource: uri,
        }),
      );
      testMarkersData(
        markerManager.getMarkers({
          type: 'typescript',
        }),
      );
      testMarkersData(
        markerManager.getMarkers({
          severities: MarkerSeverity.Hint,
        }),
      );
      done();
    });

    markerManager.updateMarkers('typescript', editorUri.toString(), [rawMarker]);
  });
  it('markers manager will ignore invalid markers and fix line/col number', (done) => {
    expect.assertions(6);
    const markerManager = injector.get(MarkerManager);
    const rawMarker = {
      code: '1234',
      codeHref: testUri,
      message: 'hello',
      startLineNumber: -1,
      endLineNumber: -3,
      startColumn: -1,
      endColumn: -5,
      severity: MarkerSeverity.Hint,
    };
    const noMessageMarker = {
      code: '1234',
      codeHref: testUri,
      message: '',
      startLineNumber: -1,
      endLineNumber: -3,
      startColumn: -1,
      endColumn: -5,
      severity: MarkerSeverity.Hint,
    };
    let triggered = 0;
    markerManager.onMarkerChanged((uris) => {
      const uri = uris[0];
      const markers = markerManager.getMarkers({
        resource: uri,
      });
      if (uri === editorUri.toString()) {
        expect(markers.length).toEqual(1);
        expect(markers[0].startLineNumber).toEqual(1);
        expect(markers[0].endLineNumber).toEqual(1);
        expect(markers[0].startColumn).toEqual(1);
        expect(markers[0].endColumn).toEqual(1);
        triggered++;
      }
      if (uri === editorUri2.toString()) {
        expect(markers.length).toEqual(1);
        triggered++;
      }

      if (triggered === 2) {
        done();
      }
    });

    markerManager.updateMarkers('typescript', editorUri.toString(), [rawMarker]);
    // noMessageMarker 不会触发 markerChanged 事件
    markerManager.updateMarkers('typescript', editorUri2.toString(), [rawMarker, noMessageMarker]);
  });
});
