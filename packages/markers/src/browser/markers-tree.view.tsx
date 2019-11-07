import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import { observer, useComputed } from 'mobx-react-lite';
import * as React from 'react';
import { SeverityIconStyle } from './markers-seriverty-icon';
import { MarkerService, ViewSize } from './markers-service';
import { MarkerViewModel } from './markers.model';
import * as styles from './markers.module.less';
import Messages from './messages';

const TAG_NONE = '';
const EMPTY_FOLDING: string[] = [];
const DEFAULT_VIEWSIZE: ViewSize = {
  w: '100%',
  h: 500,
};

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
      // console.error(size);
      updateViewSize(size);
    });
  });

  const nodes = useComputed(() => {
    let nodes: TreeNode[] = [];
    viewModel.markers.forEach((model, _) => {
      if (model.match) {
        const groupId = `marker-group-${model.resource}`;
        const isFolding = folding.indexOf(groupId) > -1;
        const item: TreeNode = {
          id: groupId,
          name: model.filename,
          icon: model.icon,
          description: model.longname,
          badge: model.size(),
          parent: undefined,
          expanded: !isFolding,
          depth: 0,
        };
        nodes.push(item);
        if (!isFolding) {// 非folding状态显示
          item.children = model.markers.map((marker, cindex) => {
            const code = marker.code && `(${marker.code})` || '';
            const id = `marker-group-${model.resource}-item-${cindex}`;
            return {
              id,
              iconStyle: SeverityIconStyle[markerService.getThemeType()][marker.severity],
              name: marker.message,
              description: `${marker.source}${code} [${marker.startLineNumber},${marker.startColumn}]`,
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

  const CONTENT_PADDING_RIGHT = 5;
  const CONTENT_PADDING_LEFT = 5;
  const CONTENT_PADDING_TOP = 2;
  const CONTENT_PADDING_BOTTOM = 5;

  const contentStyle = {
    paddingLeft: CONTENT_PADDING_LEFT,
    paddingRight: CONTENT_PADDING_RIGHT,
    paddingTop: CONTENT_PADDING_TOP,
    paddingBottom: CONTENT_PADDING_BOTTOM,
    width: '100%' ,
    height: '100%' ,
  };
  return (
    <div style={contentStyle}>
      <RecycleTree
        nodes={ nodes }
        outline={ false }
        scrollContainerStyle={{ width: viewSize.w - (CONTENT_PADDING_RIGHT + CONTENT_PADDING_LEFT), height: viewSize.h - (CONTENT_PADDING_TOP + CONTENT_PADDING_BOTTOM), key: 'marker-list' }}
        containerHeight={ viewSize.h - (CONTENT_PADDING_TOP + CONTENT_PADDING_BOTTOM) }
        onSelect={ (items) => {
          const item = items && items[0];
          if (!item) { return; }

          if (item.parent) {// children
            updateSelectTag(item.id);
            markerService.openEditor(item.marker.resource, item.marker);
          } else {
            const index = folding.indexOf(item.id);
            if (index > -1) {
              folding.splice(index, 1);
            } else {
              folding.push(item.id);
            }
            updateFolding([...folding]);
          }
        }}
      />
    </div>
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
          <MarkerList viewModel={viewModel} /> :
          <Empty />
      }
    </div>
  );
});
