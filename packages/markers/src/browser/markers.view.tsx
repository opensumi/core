import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { IMatch } from '@ali/ide-core-common/lib/filters';
import * as cls from 'classnames';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { IFilterMatches, RenderableMarker, RenderableMarkerModel } from '../common';
import { SeverityIconStyle } from './markers-seriverty-icon';
import { MarkerService } from './markers-service';
import { MarkerViewModel } from './markers.model';
import * as styles from './markers.module.less';
import Messages from './messages';

const TAG_NONE = '';

const ICONS = {
  FOLD: getIcon('right'),
};

const MarkerListContext = React.createContext({
  tag: TAG_NONE,
  updateTag: (v: string) => { },
});

/**
 * render marker title
 * @param uri marker source
 */
const MarkerItemTitle: React.FC<{ model: RenderableMarkerModel, open: boolean, onClick: () => void }> = observer(({ model, open, onClick }) => {
  return (
    <div className={styles.itemTitle} onClick={onClick}>
      <div className={cls(open ? styles.fold : styles.unfold, ICONS.FOLD)} />
      <div className={cls(model.icon)} />
      <div className={styles.filename}>{model.filename}</div>
      <div className={styles.filepath}>{model.longname}</div>
      <div className={styles.totalCount}>{model.size()}</div>
    </div>
  );
});

/**
 * render marker message
 * @param data marker model
 */
const MarkerItemContents: React.FC<{ model: RenderableMarkerModel }> = observer(({ model }) => {
  const markerItemList: React.ReactNode[] = [];
  if (model) {
    let index = 0;
    const markerService = MarkerService.useInjectable();
    model.markers.forEach((marker) => {
      const markerTag = `${model.resource}-${index++}`; // 选中的item的tag，TODO最好每个marker有唯一id
      markerItemList.push((
        <MarkerListContext.Consumer key={`marker-item-content-${index}`}>
          {
            ({ tag, updateTag }) => {
              const theme = markerService.getThemeType();
              return (
                <div className={cls(styles.itemContent, tag === markerTag ? styles.checkedBg : '')} onClick={() => {
                  updateTag(markerTag);
                  markerService.openEditor(model.resource, marker);
                }}>
                  <div className={styles.severity} style={SeverityIconStyle[theme][marker.severity]} />
                  <div className={cls(styles.detailContainer, tag === markerTag ? styles.checkedContainer : '')}>
                    <MarkerItemMessage data={marker} matches={marker.matches} />
                    <MarkerItemSourceAndCode data={marker} matches={marker.matches} />
                    <MarkerItemPosition data={marker} />
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
      {markerItemList}
    </div>
  );

});

/**
 * render highlight info which is filterd
 */
const HightlightData: React.FC<{ data: string, matches: IMatch[], className: string }> = observer(({ data, matches, className }) => {
  const result: React.ReactNode[] = [];
  let first = 0;
  matches.forEach((match) => {
    if (first < match.start) {
      result.push(<span key={`hightlight-data-${first}-${match.start}`}>{data.substring(first, match.start)}</span>);
    }
    result.push(<span key={`hightlight-data-${match.start}-${match.end}`} className={styles.highlight}>{data.substring(match.start, match.end)}</span>);
    first = match.end;
  });
  if (first < data.length) {
    result.push(<span key={`hightlight-data-${first}-${data.length - 1}`}>{data.substring(first)}</span>);
  }
  return (
    <div className={className}>{result}</div>
  );
});

/**
 * render marker message
 */
const MarkerItemMessage: React.FC<{ data: RenderableMarker, matches?: IFilterMatches }> = observer(({ data, matches }) => {
  const messageMatchs = matches && matches.messageMatches;
  if (messageMatchs) {
    return <HightlightData data={data.message} matches={messageMatchs} className={styles.detail} />;
  } else {
    return (
      <div className={styles.detail}>{data.message}</div>
    );
  }
});

/**
 * render marker source and code
 */
const MarkerItemSourceAndCode: React.FC<{ data: RenderableMarker, matches?: IFilterMatches }> = observer(({ data, matches }) => {
  const sourceMatches = matches && matches.sourceMatches;
  const codeMatches = matches && matches.codeMatches;
  return (
    <div className={styles.typeContainer}>
      {sourceMatches ? data.source && <HightlightData data={data.source} matches={sourceMatches} className={styles.type} /> : data.source}
      {data.code && '('}
      {data.code && codeMatches ? <HightlightData data={data.code} matches={codeMatches} className={styles.type} /> : data.code}
      {data.code && ')'}
    </div>
  );
});

/**
 * render marker position
 */
const MarkerItemPosition: React.FC<{ data: RenderableMarker }> = observer(({ data }) => {
  return (
    <div className={styles.position}>{`[${data.startLineNumber},${data.startColumn}]`}</div>
  );
});

/**
 * render single marker model
 */
const MarkerItem: React.FC<{ model: RenderableMarkerModel }> = observer(({ model }) => {
  const [open, setOpen] = React.useState(true);

  if (model.size() > 0) {
    return (
      <div className={styles.markerItem}>
        <MarkerItemTitle model={model} open={open} onClick={() => {
          setOpen(!open);
        }} />
        {open && <MarkerItemContents model={model} />}
      </div>
    );
  } else {
    return <FilterEmpty />;
  }
});

/**
 * render marker list
 * @param viewModel marker view model
 */
const MarkerList: React.FC<{ viewModel: MarkerViewModel }> = observer(({ viewModel }) => {
  const result: React.ReactNode[] = [];
  if (viewModel) {
    let index = 0;
    viewModel.markers.forEach((model, _) => {
      result.push(<MarkerItem key={`marker-group-${index++}`} model={model} />);
    });
  }
  return (
    <div className={styles.markerList}>
      {result}
    </div>
  );
});

/**
 * empty maker
 */
const Empty: React.FC = observer(() => {
  return <div className={styles.empty}>{Messages.MARKERS_PANEL_CONTENT_EMPTY}</div>;
});

/**
 * empty maker when filtered
 */
const FilterEmpty: React.FC = observer(() => {
  return <div className={styles.empty}>{Messages.MARKERS_PANEL_FILTER_CONTENT_EMPTY}</div>;
});

/**
 * marker panel
 */
export const MarkerPanel = observer(() => {
  const ref = React.useRef<HTMLElement | null>();
  const [tag, updateTag] = React.useState('');
  const markerService = MarkerService.useInjectable();
  const viewModel = markerService.getViewModel();

  React.useEffect(() => {
    if (ref.current) {
      markerService.onMarkerChanged(() => {
        updateTag(TAG_NONE);
      });
    }
  });

  return (
    <MarkerListContext.Provider value={{ tag, updateTag }}>
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
