import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, IMarkerService, MarkerSeverity, MarkerModel, UniqueMarkerData } from '@ali/ide-core-browser';
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

const MarkerListContext = React.createContext({
  tag: '',
  updateTag: (v: string) => {},
});

/**
 * Marker标题
 * @param uri 资源
 */
const MarkerItemTitle: React.FC<{ model: MarkerModel, open: boolean, onClick: () => void }> = observer(({ model, open, onClick }) => {
  return (
    <div className={ styles.itemTitle } onClick={onClick}>
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
const MarkerItemContents: React.FC<{model: MarkerModel}> = observer(({ model }) => {
  const markerItemList: React.ReactNode[] = [];
  if (model) {
    let index = 0;
    model.markers.forEach((marker) => {
      index = index + 1;
      const markerTag = `${model.uri}-${index}`; // 选中的item的tag，TODO最好每个marker有唯一id
      markerItemList.push((
        <MarkerListContext.Consumer>
          {
            ({tag, updateTag}) => (
              <div key={`marker-item-content-${index}`} className={ cls(styles.itemContent, tag === markerTag ? styles.checked : '') } onClick={() => {
                updateTag(markerTag);
              }}>
                <div className={cls(ICONS.SEVERITY[marker.severity], styles.severity)} />
                <div className={styles.detail}>{ marker.message }</div>
                <div className={styles.type}>{ `${marker.source}(${marker.code})` }</div>
                <div className={styles.position}>{ `[${marker.startColumn},${marker.endColumn}]` }</div>
              </div>
            )
          }
        </MarkerListContext.Consumer>
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
const MarkerItem: React.FC<{key: string, model: MarkerModel}> = observer(({key, model}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div key={key} className={styles.markerItem}>
      <MarkerItemTitle model={model} open={open} onClick={() => {
        setOpen(!open);
      }}/>
      {open && <MarkerItemContents model={model} />}
    </div>
  );
});

/**
 * 指定类型的Marker列表
 * @param markerMap markers
 */
const MarkerType: React.FC<{key: string, type: string, markers: Map<string, MarkerModel> | undefined}> =
  observer(({ key, type, markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let index = 0;
    markers.forEach((model, _) => {
      result.push(<MarkerItem key={`marker-group-${index++}`} model={model}/>);
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
 * 所有类型的Marker
 * @param allMarkers 所有的markers
 */

const MarkerList: React.FC<{markers: Map<string, Map<string, MarkerModel> | undefined>}> = observer(({ markers }) => {
  const result: React.ReactNode[] = [];
  if (markers) {
    let index = 0;
    markers.forEach((collection, type) => {
      result.push(<MarkerType key={`marker-type-${index++}`} type={type} markers={collection}/>);
    });
  }
  const [tag, updateTag] = React.useState('');
  const tagUpdater = {tag, updateTag}; // 防止创建provider.value
  return (
    <MarkerListContext.Provider value={tagUpdater}>
      <div className={styles.markerList}>
        { result }
      </div>
    </MarkerListContext.Provider>
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
