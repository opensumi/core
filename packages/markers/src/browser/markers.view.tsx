import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, IMarkerService, MarkerSeverity, MarkerModel } from '@ali/ide-core-browser';
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
 * Marker标题
 * @param uri 资源
 */
const MarkerItemTitle: React.FC<{ model: MarkerModel, open: boolean, onClick: () => void }> = observer(({ model, open, onClick }) => {
  return (
    <div className={ styles.itemTitle } onClick={() => {
      onClick();
    }}>
      <div className={ cls(open ? styles.fold : styles.unfold, ICONS.FOLD) } />
      <div className={ cls(model.icon)} />
      <div className={styles.filename}>{ model.filename }</div>
      <div className={styles.filepath}>{ model.longname }</div>
      <div className={styles.totalCount}>{ model.size() }</div>
    </div>
  );
});

/**
 * Marker详细信息`
 * @param data marker的数据
 */
const MarkerItemContents: React.FC<{model: MarkerModel, check: string, updateCheck: (v: string) => void}> = observer(({ model, check, updateCheck}) => {
  const markerItemList: React.ReactNode[] = [];
  if (model) {
    let key = 0;
    model.markers.forEach((marker) => {
      const checkTag = `${model.uri}-${key}`; // 选中的item的tag
      markerItemList.push((
        <div key={`marker-item-content-${key++}`} className={ cls(styles.itemContent, check === checkTag && styles.checked) } onClick={() => {
          updateCheck(checkTag);
        }}>
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
 * Marker
 */
const MarkerItem: React.FC<{key: string, model: MarkerModel, check: string, updateCheck: (v: string) => void}> = observer(({key, model, check, updateCheck}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div key={key} className={styles.markerItem}>
      <MarkerItemTitle model={model} open={open} onClick={() => {
        setOpen(!open);
      }}/>
      {open && <MarkerItemContents model={model} check={check} updateCheck={updateCheck} />}
    </div>
  );
});

/**
 * 指定类型的Marker列表
 * @param markerMap markers
 */
const MarkerType: React.FC<{type: string, markers: Map<string, MarkerModel> | undefined, check: string, updateCheck: (v: string) => void}> = observer(({ type, markers, check, updateCheck }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let key = 0;
    markers.forEach((model, _) => {
      result.push(<MarkerItem key={`marker-group-${key++}`} model={model} check={check} updateCheck={updateCheck}/>);
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
 * 所有类型的Marker
 * @param allMarkers 所有的markers
 */

const MarkerList: React.FC<{markers: Map<string, Map<string, MarkerModel> | undefined>}> = observer(({ markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let key = 0;
    const [check, updateCheck] = React.useState(); // TODO 需要换地方
    markers.forEach((collection, type) => {
      result.push((
        <div key={`marker-type-${key++}`} className={styles.markerType}>
          <MarkerType type={type} markers={collection} check={check} updateCheck={updateCheck}/>
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
