import * as React from 'react';
import { observer } from 'mobx-react-lite';
import {  useInjectable, IMarkerService, MarkerModel } from '@ali/ide-core-browser';
import { MarkerService } from './markers-service';
import { nls } from '../common/index';
import * as styles from './markers.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { SeverityIconStyle } from './markers-seriverty-icon';
import * as cls from 'classnames';
import { MarkerViewModel } from './markers-view-model';

const NO_ERROR = nls.localize('markers.content.empty', '目前尚未在工作区检测到问题。');
const TAG_NONE = '';

const ICONS = {
  FOLD: getIcon('right'),
};

const MarkerListContext = React.createContext({
  tag: TAG_NONE,
  updateTag: (v: string) => {},
});

const getMarkerService = (): MarkerService => {
  return useInjectable<IMarkerService>(MarkerService) as MarkerService;
};

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
    const markerService = getMarkerService();
    model.markers.forEach((marker) => {
      const markerTag = `${model.uri}-${index++}`; // 选中的item的tag，TODO最好每个marker有唯一id
      markerItemList.push((
        <MarkerListContext.Consumer key={`marker-item-content-${index}`}>
          {
            ({tag, updateTag}) => {
              const theme = markerService.getThemeType();
              return (
                <div className={ cls(styles.itemContent, tag === markerTag ? styles.checkedBg : '') } onClick={() => {
                  updateTag(markerTag);
                  markerService.openEditor(model.uri, marker);
                }}>
                  <div className={styles.severity} style={SeverityIconStyle[theme][marker.severity]}/>
                  <div className={ cls(styles.detailContainer, tag === markerTag ? styles.checkedContainer : '') }>
                    <div className={styles.detail}>{ marker.message }</div>
                    <div className={styles.type}>
                      { marker.source }
                      { marker.code && `(${marker.code})`}
                    </div>
                    <div className={styles.position}>{ `[${marker.startLineNumber},${marker.startColumn}]` }</div>
                  </div>
                </div>
              );
            }
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
 * Single Marker Item
 */
const MarkerItem: React.FC<{model: MarkerModel}> = observer(({model}) => {
  const [open, setOpen] = React.useState(true);
  return (
    <div className={styles.markerItem}>
      <MarkerItemTitle model={model} open={open} onClick={() => {
        setOpen(!open);
      }}/>
      {open && <MarkerItemContents model={model} />}
    </div>
  );
});

/**
 * Marker列表
 * @param markers markers
 */
const MarkerList: React.FC<{viewModel: MarkerViewModel}> = observer(({ viewModel }) => {
  const result: React.ReactNode[] = [];
  if (viewModel) {
    let index = 0;
    viewModel.markers.forEach((model, _) => {
      result.push(<MarkerItem key={`marker-group-${index++}`} model={model}/>);
    });
  }
  return (
    <div className={styles.markerList}>
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
  const ref = React.useRef<HTMLElement | null>();
  const [tag, updateTag] = React.useState('');
  const markerService = getMarkerService();
  const viewModel = markerService.getViewModel();

  React.useEffect(() => {
    if (ref.current) {
      markerService.onMarkerChanged(() => {
        updateTag(TAG_NONE);
      });
    }
  });

  return (
    <MarkerListContext.Provider value={{tag, updateTag}}>
      <div className={styles.markersContent} ref={(ele) => ref.current = ele}>
        {
          viewModel.hasData() ?
          <MarkerList viewModel={viewModel} /> :
          <Empty />
        }
      </div>
    </MarkerListContext.Provider>
  );
});
