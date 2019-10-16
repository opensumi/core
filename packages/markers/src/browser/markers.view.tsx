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
  UNFOLD: getIcon('save-all'),
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

const MarkerItemContext = React.createContext({
  open: true,
  selected: false,
});

/**
 * 渲染条目标题
 * @param uri 资源
 */
const MarkerItemTitle: React.FC<{model: MarkerModel}> = observer(({ model }) => {
  const ctx = React.useContext(MarkerItemContext);
  return (
    <div className={styles.itemTitle} onClick={() => {
      console.error('====>', ctx.open);
      ctx.open = !ctx.open;
    }}>
      <div className={ cls(styles.fold, [ctx.open ? ICONS.FOLD : ICONS.UNFOLD])} />
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
const MarkerItemContents: React.FC<{model: MarkerModel}> = observer(({ model }) => {
  const context = React.useContext(MarkerItemContext);
  if (!context.open) {
    return null;
  }
  const markerItemList: React.ReactNode[] = [];
  if (model) {
    let index = 0;
    model.markers.forEach((marker) => {
      markerItemList.push((
        <div key={`marker-item-content-${index++}`} className={styles.itemContent}>
          <div className={cls(ICONS.SEVERITY[marker.severity], styles.severity)} />
          <div className={styles.detail}>{ marker.message }</div>
          <div className={styles.type}>{ `${marker.source}(${marker.code})` }</div>
          <div className={styles.position}>{ `[${marker.startColumn},${marker.endColumn}]` }</div>
        </div>
      ));
    });
  }
  return (
    <div>
      { markerItemList }
    </div>
  );
});

/**
 * 渲染marker类型
 * @param markerMap markers
 */
const MarkerType: React.FC<{type: string, markers: Map<string, MarkerModel> | undefined}> = observer(({ type, markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let key = 0;
    markers.forEach((model, _) => {
      result.push((
        <div key={`marker-group-${key++}`} className={styles.markerItem}>
          <MarkerItemTitle model={model} />
          <MarkerItemContents model={model} />
        </div>
      ));
    });
  }
  return (
    <div>
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
      result.push((
        <div key={`marker-type-${key++}`} className={styles.markerType}>
          <MarkerType type={type} markers={collection}/>
        </div>
      ));
    });
  }
  return (
    <div>
      { result }
    </div>
  );
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
  return (
    <div className={styles.markersContent}>
      {
        markerService.hasMarkers() ?
        <MarkerList markers={markerService.getAllMarkers()} /> :
        <Empty />
      }
    </div>
  );
});
