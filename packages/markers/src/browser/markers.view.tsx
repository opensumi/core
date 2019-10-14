import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, IMarkerService, IMarkerData } from '@ali/ide-core-browser';
import { MarkerService } from './markers-service';
import { nls } from '../common/index';
import * as styles from './markers.module.less';

const NO_ERROR = nls.localize('markers.content.empty', '目前尚未在工作区检测到问题。');

/**
 * 渲染条目标题
 * @param uri 资源
 */
function renderMarkerItemTitle(uri: string, count: number) {
  const filetype = uri && uri.substr(uri.lastIndexOf('.') + 1);
  const filename = uri && uri.substr(uri.lastIndexOf('/') + 1);
  return (
    <div className={styles.itemTitle}>
      <div className={styles.fold}>+</div>
      <div className={styles.icon}>{ filetype.toUpperCase() }</div>
      <div className={styles.filename}>{ filename }</div>
      <div className={styles.filepath}>{ uri }</div>
      <div className={styles.totalCount}>{ count }</div>
    </div>
  );
}

/**
 * 渲染条目详细信息
 * @param data marker的数据
 */
function renderMarkerItemContent(key: string, data: IMarkerData) {
  return (
    <div key={key} className={styles.itemContent}>
      <div className={styles.severity}>{ data.severity }</div>
      <div className={styles.detail}>{ data.message }</div>
      <div className={styles.type}>{ `${data.source}(${data.code})` }</div>
      <div className={styles.position}>{ `[${data.startColumn},${data.endColumn}]` }</div>
    </div>
  );
}

/**
 * 渲染指定URI
 * @param uri 资源URI
 * @param markers 对应的markers
 */
function renderMarkers(markerKey: string, uri: string, markers: IMarkerData[]) {
  const markerItems: React.ReactNode[] = [];
  let key = 0;
  markers.forEach((marker) => {
    markerItems.push(renderMarkerItemContent(`marker-item-${key++}`, marker));
  });
  return (
    <div key={markerKey} className={styles.markerItem}>
      { renderMarkerItemTitle(uri, markers.length) }
      { markerItems }
    </div>
  );
}

/**
 * 渲染marker类型
 * @param markerMap markers
 */
function renderMarkersOfType(domKey: string, type: string, markerMap: Map<string, IMarkerData[]> | undefined) {
  const result: React.ReactNode[] = [];
  if (markerMap) {
    let key = 0;
    markerMap.forEach((markers, uri) => {
      result.push(renderMarkers(`marker-group-${key++}`, uri, markers));
    });
  }
  return (
    <div key={domKey} className={styles.markerType}>
      { result }
    </div>
  );
}

/**
 * markers
 * @param allMarkers 所有的markers
 */
function renderAllMarkers(allMarkers: Map<string, Map<string, IMarkerData[]>>) {
  const result: React.ReactNode[] = [];
  if (allMarkers) {
    let key = 0;
    allMarkers.forEach((typeMarkers, type) => {
      result.push(renderMarkersOfType(`marker-type-${key++}`, type, typeMarkers));
    });
  }
  return result;
}

export const Markers = observer(() => {
  const markerService = useInjectable<IMarkerService>(MarkerService);
  let content;
  if (markerService.hasMarkers()) {
    const allMarkers = markerService.getAllMarkers();
    console.error('------>render', markerService.getStatistics());
    content = (
      <div className={styles.normal}>{ renderAllMarkers(allMarkers) }</div>
    );
  } else {
    content = (
      <div className={styles.empty}>{ NO_ERROR }</div>
    );
  }
  return (
    <div className={styles.markersContent}>
      { content }
    </div>
  );
});
