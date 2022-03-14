import { observer, useComputed } from 'mobx-react-lite';
import React from 'react';

import { ViewState, useInjectable } from '@opensumi/ide-core-browser';
import { DeprecatedRecycleTree, TreeNode } from '@opensumi/ide-core-browser/lib/components';
import { IMatch } from '@opensumi/ide-core-common/lib/filters';


import { IMarkerService, IRenderableMarker, IRenderableMarkerModel } from '../common';

import { SeverityIconStyle } from './markers-seriverty-icon';
import { MarkerService } from './markers-service';
import { MarkerViewModel } from './markers.model';
import styles from './markers.module.less';
import Messages from './messages';


const TAG_NONE = '';
const EMPTY_FOLDING: string[] = [];

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
const MarkerItemTitleDescription: React.FC<{ model: IRenderableMarkerModel }> = observer(({ model }) => (
  <div className={styles.itemTitleDescription}>{model.longname}</div>
));

/**
 * render highlight info which is filterd
 */
const HightlightData: React.FC<{ data: string; matches: IMatch[]; className: string }> = observer(
  ({ data, matches, className }) => {
    const result: React.ReactNode[] = [];
    let first = 0;
    matches.forEach((match) => {
      if (first < match.start) {
        result.push(<span key={`hightlight-data-${first}-${match.start}`}>{data.substring(first, match.start)}</span>);
      }
      result.push(
        <span key={`hightlight-data-${match.start}-${match.end}`} className={styles.highlight}>
          {data.substring(match.start, match.end)}
        </span>,
      );
      first = match.end;
    });
    if (first < data.length) {
      result.push(<span key={`hightlight-data-${first}-${data.length - 1}`}>{data.substring(first)}</span>);
    }
    return <div className={className}>{result}</div>;
  },
);

/**
 * render marker message
 */
const MarkerItemName: React.FC<{ data: IRenderableMarker }> = observer(({ data }) => {
  const messageMatchs = data.matches && data.matches.messageMatches;
  if (messageMatchs) {
    return <HightlightData data={data.message} matches={messageMatchs} className={styles.itemDetailName} />;
  } else {
    return <div className={styles.itemDetailName}>{data.message}</div>;
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
        {sourceMatches
          ? data.source && <HightlightData data={data.source} matches={sourceMatches} className={styles.type} />
          : data.source}
        {data.code && '('}
        {data.code && codeMatches ? (
          <HightlightData data={data.code} matches={codeMatches} className={styles.type} />
        ) : (
          data.code
        )}
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
const MarkerList: React.FC<{ viewModel: MarkerViewModel; viewState: ViewState }> = observer(
  ({ viewModel, viewState }) => {
    const markerService: MarkerService = useInjectable(IMarkerService);
    const [selectTag, updateSelectTag] = React.useState('');
    const [folding, updateFolding] = React.useState(EMPTY_FOLDING);

    React.useEffect(() => {
      const markerChangedDispose = markerService.getManager().onMarkerChanged(() => {
        updateSelectTag(TAG_NONE);
      });
      const resourceCloseDispose = markerService.onResourceClose((res: string) => {
        const groupId = buildItemGroupId(res);
        updateFolding(removeFolding(folding, groupId));
      });
      return () => {
        markerChangedDispose.dispose();
        resourceCloseDispose.dispose();
      };
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
            badgeLimit: 999,
            parent: undefined,
            expanded: !isFolding,
            depth: 0,
            tooltip: model.resource,
          };

          nodes.push(item);
          if (!isFolding) {
            // 非folding状态显示
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
                tooltip: marker.message,
              };
            });
            nodes = nodes.concat(item.children);
          } else {
            item.children = [];
          }
        }
      });
      return nodes;
    }, [selectTag, folding]);

    return (
      <DeprecatedRecycleTree
        nodes={nodes}
        outline={false}
        scrollContainerStyle={{ width: '100%', height: '100%', key: 'marker-list' }}
        containerHeight={viewState.height}
        onSelect={(items) => {
          const item = items && items[0];
          if (!item) {
            return;
          }

          if (item.parent) {
            // children
            updateSelectTag(item.id);
            markerService.openEditor(item.marker.resource, item.marker);
          } else {
            updateFolding(toggleNewFolding(folding, item.id));
          }
        }}
      />
    );
  },
);

/**
 * empty marker
 */
const Empty: React.FC = observer(() => {
  const markerService: MarkerService = useInjectable(IMarkerService);
  const viewModel = markerService.getViewModel();
  if (viewModel.hasFilter()) {
    return (
      <div className={styles.empty}>
        {Messages.markerPanelFilterContentEmpty()}
        <div
          className={styles.reset}
          onClick={() => {
            markerService.fireFilterChanged(undefined);
          }}
        >
          {Messages.markerPanelFilterReset()}
        </div>
      </div>
    );
  } else {
    return <div className={styles.empty}>{Messages.markerPanelContentEmpty()}</div>;
  }
});

/**
 * marker panel
 */
export const MarkerPanel = observer(({ viewState }: { viewState: ViewState }) => {
  const markerService: MarkerService = useInjectable(IMarkerService);
  const viewModel = markerService.getViewModel();

  return (
    <div ref={markerService.rootEle} className={styles.markersContent}>
      {viewModel.hasData() ? <MarkerList viewModel={viewModel} viewState={viewState} /> : <Empty />}
    </div>
  );
});
