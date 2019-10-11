import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, IMarkerService, IMarkerData } from '@ali/ide-core-browser';
import { MarkerService } from './markers-service';

/**
 * 渲染指定URI
 * @param uri 资源URI
 * @param markers 对应的markers
 */
function renderMarkerUri(uri: string, markers: IMarkerData[]) {
  const result: React.ReactNode[] = [];
  let key = 0;
  markers.forEach((marker) => {
    result.push((
      <li key={`marker-item-${key++}`}>
        { marker.message }
      </li>
    ));
  });
  return result;
}

/**
 * 渲染marker类型
 * @param markerMap markers
 */
function renderMarkerType(markerMap: Map<string, IMarkerData[]> | undefined) {
  const result: React.ReactNode[] = [];
  if (markerMap) {
    let key = 0;
    markerMap.forEach((markers, uri) => {
      result.push((
        <ul key={`marker-group-${key++}`}>
          { renderMarkerUri(uri, markers) }
        </ul>
      ));
    });
  }
  return (
    <div>
      { result }
    </div>
  );
}

const NO_ERROR = '目前尚未在工作区检测到问题。';

export const Markers = observer(() => {
  const markerService = useInjectable<IMarkerService>(MarkerService);
  let content;
  if (markerService.hasMarkers()) {
    const typeScriptMarkers = markerService.getMarkers('typescript');
    content = renderMarkerType(typeScriptMarkers);
  } else {
    content = NO_ERROR;
  }
  return (
    <React.Fragment>
      <div>{ content }</div>
    </React.Fragment>
  );
});
