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
const MarkerItemTitle: React.FC<{model: MarkerModel}> = observer(({ model }) => {
  return (
    <div className={styles.itemTitle} onClick={() => {
      model.toogle();
    }}>
      <div className={ cls(ICONS.FOLD, styles.fold, [model.fold ? 'transform: rotate(90deg);' : 'transform: rotate(0deg);'])} />
      <div className={ cls(model.icon)} />
      <div className={styles.filename}>{ model.filename }</div>
      <div className={styles.filepath}>{ model.longname }</div>
      <div className={styles.totalCount}>{ model.size() }</div>
    </div>
  );
});

/**
 * 渲染条目详细信息
 * @param data marker的数据
 */
const MarkerItemContent: React.FC<{key: string, data: IMarkerData}> = observer(({ key, data }) => {
  return (
    <div key={key} className={styles.itemContent}>
      <div className={cls(ICONS.SEVERITY[data.severity], styles.severity)} />
      <div className={styles.detail}>{ data.message }</div>
      <div className={styles.type}>{ `${data.source}(${data.code})` }</div>
      <div className={styles.position}>{ `[${data.startColumn},${data.endColumn}]` }</div>
    </div>
  );
});

/**
 * 渲染指定URI
 * @param uri 资源URI
 * @param markers 对应的markers
 */
const MarkerItem: React.FC<{key: string, model: MarkerModel}> = observer(({ key, model }) => {
  const markerItems: React.ReactNode[] = [];
  if (model) {
    let key = 0;
    model.markers.forEach((marker) => {
      markerItems.push(<MarkerItemContent key={`marker-item-${key++}`} data={marker} />);
    });
  }
  return (
    <div key={key} className={styles.markerItem}>
      <MarkerItemTitle model={model} />
      { markerItems }
    </div>
  );
});

/**
 * 渲染marker类型
 * @param markerMap markers
 */
const MarkerType: React.FC<{key: string, type: string, markers: Map<string, MarkerModel> | undefined}> = observer(({ key, type, markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let key = 0;
    markers.forEach((markerModel, _) => {
      result.push(<MarkerItem key={`marker-group-${key++}`} model={markerModel}/>);
    });
  }
  return (
    <div key={key} className={styles.markerType}>
      { type }
      { result }
    </div>
  );
});

/**
 * markers
 * @param allMarkers 所有的markers
 */
const MarkerList: React.FC<{markers: Map<string, Map<string, MarkerModel> | undefined>}> = observer(({ markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let key = 0;
    markers.forEach((collection, type) => {
      result.push(<MarkerType key={`marker-type-${key++}`} type={type} markers={collection}/>);
    });
  }
  return result;
});

/**
 * 空数据展示
 */
const Empty: React.FC = observer(() => {
  return <div className={styles.empty}>{ NO_ERROR }</div>;
});

/**
 *
 */
export const MarkerPanel = observer(() => {
  const markerService = useInjectable<IMarkerService>(MarkerService);
  let content;
  if (markerService.hasMarkers()) {
    content = <MarkerList markers={markerService.getAllMarkers()} />;
  } else {
    content = <Empty />;
  }
  return (
    <React.Fragment>
      <div className={styles.markersContent}>
        { content }
      </div>
    </React.Fragment>
  );
});
