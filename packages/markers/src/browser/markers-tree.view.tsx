import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { observer, useComputed } from 'mobx-react-lite';
import { IMatch } from '@ali/ide-core-common/lib/filters';
import * as React from 'react';
import { SeverityIconStyle } from './markers-seriverty-icon';
import { MarkerService, ViewSize } from './markers-service';
import { MarkerViewModel } from './markers.model';
import * as styles from './markers.module.less';
import Messages from './messages';
import { IRenderableMarker, IRenderableMarkerModel } from '../common';

const TAG_NONE = '';
const EMPTY_FOLDING: string[] = [];
const DEFAULT_VIEWSIZE: ViewSize = {
  w: 0,
  h: 0,
};

function toggleNewFolding(folding: string[] = [], res: string): string[] {
  const index = folding.indexOf(res);
  if (index > -1) {
    folding.splice(index, 1);
  } else {
    folding.push(res);
  }
  return [...folding];
}

function removeFolding(folding: string[] = [], res: string): string[] {
  const index = folding.indexOf(res);
  if (index > -1) {
    folding.splice(index, 1);
  }
  return [...folding];
}

function buildItemGroupId(res: string): string {
  return `marker-group-${res}`;
}

function buildItemChildId(res: string, index: number): string {
  return `marker-group-${res}-item-${index}`;
}

/**
 * render marker filename
 * @param model model of renderable marker
 */
const MarkerItemTitleName: React.FC<{ model: IRenderableMarkerModel }> = observer(({ model }) => {
  const filenameMatches = model.matches && model.matches.filenameMatches;
  if (filenameMatches) {
    return <HightlightData data={model.filename} matches={filenameMatches} className={styles.itemTitleName} />;
  } else {
    return <div className={styles.itemTitleName}>{model.filename}</div>;
  }
});

/**
 * render marker filepath
 * @param model model of renderable marker
 */
const MarkerItemTitleDescription: React.FC<{ model: IRenderableMarkerModel }> = observer(({ model }) => {
  return <div className={styles.itemTitleDescription}>{model.longname}</div>;
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
const MarkerItemName: React.FC<{ data: IRenderableMarker }> = observer(({ data }) => {
  const messageMatchs = data.matches && data.matches.messageMatches;
  if (messageMatchs) {
    return <HightlightData data={data.message} matches={messageMatchs} className={styles.itemDetailName} />;
  } else {
    return (
      <div className={styles.itemDetailName}>{data.message}</div>
    );
  }
});

/**
 * render marker source and code
 */
const MarkerItemDescription: React.FC<{ data: IRenderableMarker }> = observer(({ data }) => {
  const sourceMatches = data.matches && data.matches.sourceMatches;
  const codeMatches = data.matches && data.matches.codeMatches;
  return (
    <div className={styles.itemDetailDescription}>
      <div className={styles.typeContainer}>
        {sourceMatches ? data.source && <HightlightData data={data.source} matches={sourceMatches} className={styles.type} /> : data.source}
        {data.code && '('}
        {data.code && codeMatches ? <HightlightData data={data.code} matches={codeMatches} className={styles.type} /> : data.code}
        {data.code && ')'}
      </div>
      <div className={styles.position}>{`[${data.startLineNumber},${data.startColumn}]`}</div>
    </div>
  );
});

/**
 * render marker list
 * @param viewModel marker view model
 */
const MarkerList: React.FC<{ viewModel: MarkerViewModel }> = observer(({ viewModel }) => {
  const markerService = MarkerService.useInjectable();
  const [selectTag, updateSelectTag] = React.useState('');
  const [folding, updateFolding] = React.useState(EMPTY_FOLDING);
  const [viewSize, updateViewSize] = React.useState(DEFAULT_VIEWSIZE);

  React.useEffect(() => {
    markerService.getManager().onMarkerChanged(() => {
      updateSelectTag(TAG_NONE);
    });
    markerService.onViewResize((size: ViewSize) => {
      updateViewSize(size);
    });
    markerService.onResouceClose((res: string) => {
      const groupId = buildItemGroupId(res);
      updateFolding(removeFolding(folding, groupId));
    });
  });

  const nodes = useComputed(() => {
    let nodes: TreeNode[] = [];
    viewModel.markers.forEach((model, _) => {
      if (model.match) {
        const groupId = buildItemGroupId(model.resource);
        const isFolding = folding.indexOf(groupId) > -1;
        const item: TreeNode = {
          id: groupId,
          name: () => <MarkerItemTitleName model={model} />,
          icon: model.icon,
          description: () => <MarkerItemTitleDescription model={model} />,
          badge: model.size(),
          parent: undefined,
          expanded: !isFolding,
          depth: 0,
        };

        nodes.push(item);
        if (!isFolding) {// 非folding状态显示
          item.children = model.markers.map((marker, cindex) => {
            const id = buildItemChildId(model.resource, cindex);
            return {
              id,
              iconStyle: SeverityIconStyle[markerService.getThemeType()][marker.severity],
              name: () => <MarkerItemName data={marker} />,
              description: () => <MarkerItemDescription data={marker} />,
              depth: 2,
              parent,
              selected: id === selectTag,
              marker,
            };
          });
          nodes = nodes.concat(item.children); // TODO 需要优化掉
        } else {
          item.children = [];
        }
      }
    });
    return nodes;
  }, [ selectTag, folding ]);

  return (
    <RecycleTree
      nodes={ nodes }
      outline={ false }
      scrollContainerStyle={{ width: viewSize.w - 10, height: viewSize.h - 7, key: 'marker-list' }}
      containerHeight={ viewSize.h - 7 }
      onSelect={ (items) => {
        const item = items && items[0];
        if (!item) { return; }

        if (item.parent) {// children
          updateSelectTag(item.id);
          markerService.openEditor(item.marker.resource, item.marker);
        } else {
          updateFolding(toggleNewFolding(folding, item.id));
        }
      }}
    />
  );
});

/**
 * empty marker
 */
const Empty: React.FC = observer(() => {
  const markerService = MarkerService.useInjectable();
  const viewModel = markerService.getViewModel();
  if (viewModel.hasFilter()) {
    return (
      <div className={styles.empty}>
        { Messages.MARKERS_PANEL_FILTER_CONTENT_EMPTY }
        <div className={styles.reset} onClick={() => {
          markerService.fireFilterChanged(undefined);
        }}>
          { Messages.MARKERS_PANEL_FILTER_RESET }
        </div>
      </div>
    );
  } else {
    return (
      <div className={styles.empty}>{Messages.MARKERS_PANEL_CONTENT_EMPTY}</div>
    );
  }
});

/**
 * marker panel
 */
export const MarkerPanel = observer(() => {
  const markerService = MarkerService.useInjectable();
  const viewModel = markerService.getViewModel();

  return (
    <div className={styles.markersContent}>
      {
        viewModel.hasData() ?
          <MarkerList viewModel={viewModel}/> :
          <Empty />
      }
    </div>
  );
});
