import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, IMarkerService, IMarkerData, MarkerSeverity, MarkerModel } from '@ali/ide-core-browser';
import { MarkerService } from './markers-service';
import { nls } from '../common/index';
import * as styles from './markers.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import * as cls from 'classnames';

const NO_ERROR = nls.localize('markers.content.empty', '目前尚未在工作区检测到问题。');

const ICONS = {
  FOLD: getIcon('right'),
  FILETYPE: {
    js: getIcon('save-all'),
    jsx: getIcon('save-all'),
    ts: getIcon('close-all'),
    tsx: getIcon('close-all'),
  },
  SEVERITY: {
    [MarkerSeverity.Hint]: getIcon('new-file'),
    [MarkerSeverity.Info]: getIcon('new-folder'),
    [MarkerSeverity.Warning]: getIcon('collapse-all'),
    [MarkerSeverity.Error]: getIcon('refresh'),
  },
};

/**
 * 渲染条目标题
 * @param uri 资源
 */
function renderMarkerItemTitle(markerModel: MarkerModel) {
  return (
    <div className={styles.itemTitle} onClick={() => {
      markerModel.toogle();
    }}>
      <div className={ cls(ICONS.FOLD, styles.fold, [markerModel.fold ? 'transform: rotate(90deg);' : 'transform: rotate(0deg);'])} />
      <div className={ cls(markerModel.icon)} />
      <div className={styles.filename}>{ markerModel.filename }</div>
      <div className={styles.filepath}>{ markerModel.longname }</div>
      <div className={styles.totalCount}>{ markerModel.size() }</div>
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
      <div className={cls(ICONS.SEVERITY[data.severity], styles.severity)} />
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
function renderMarkers(markerKey: string, markerModel: MarkerModel) {
  const markerItems: React.ReactNode[] = [];
  if (markerModel) {
    let key = 0;
    markerModel.markers.forEach((marker) => {
      markerItems.push(renderMarkerItemContent(`marker-item-${key++}`, marker));
    });
  }
  return (
    <div key={markerKey} className={styles.markerItem}>
      { renderMarkerItemTitle(markerModel) }
      { markerItems }
    </div>
  );
}

/**
 * 渲染marker类型
 * @param markerMap markers
 */
function renderMarkersOfType(domKey: string, type: string, markerCollection: Map<string, MarkerModel> | undefined) {
  const result: React.ReactNode[] = [];
  if (markerCollection) {
    let key = 0;
    markerCollection.forEach((markerModel, _) => {
      result.push(renderMarkers(`marker-group-${key++}`, markerModel));
    });
  }
  return (
    <div key={domKey} className={styles.markerType}>
      { type }
      { result }
    </div>
  );
}

/**
 * markers
 * @param allMarkers 所有的markers
 */
function renderAllMarkers(allMarkers: Map<string, Map<string, MarkerModel> | undefined>) {
  const result: React.ReactNode[] = [];
  if (allMarkers) {
    let key = 0;
    allMarkers.forEach((collection, type) => {
      result.push(renderMarkersOfType(`marker-type-${key++}`, type, collection));
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
    <React.Fragment>
      <div className={styles.markersContent}>
        { content }
      </div>
    </React.Fragment>
  );
});
