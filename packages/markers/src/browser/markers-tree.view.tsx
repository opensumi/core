import React, { FC, useEffect, useState, useCallback, useRef } from 'react';

import { IRecycleTreeHandle, RecycleTree } from '@opensumi/ide-components';
import { ViewState, useInjectable, Disposable } from '@opensumi/ide-core-browser';

import { IMarkerService } from '../common';

import { MarkerService } from './markers-service';
import styles from './markers.module.less';
import Messages from './messages';
import { IMarkerNodeRenderedProps, MarkerNodeRendered, MARKER_TREE_NODE_HEIGHT } from './tree/marker-node';
import { MarkerModelService, MarkerTreeModel } from './tree/tree-model.service';

const MarkerList: FC<{ viewState: ViewState }> = ({ viewState }) => {
  const [model, setModel] = useState<MarkerTreeModel | undefined>();
  const markerModelService = useInjectable<MarkerModelService>(MarkerModelService);

  useEffect(() => {
    const disposer = new Disposable();
    disposer.addDispose(
      markerModelService.onDidUpdateTreeModel((model?: MarkerTreeModel) => {
        setModel(model);
      }),
    );
    return () => {
      disposer.dispose();
    };
  }, []);

  const handleTreeReady = useCallback(
    (handle: IRecycleTreeHandle) => {
      markerModelService.handleTreeHandler(handle);
    },
    [markerModelService],
  );

  const renderTreeNode = useCallback(
    (props: IMarkerNodeRenderedProps) => {
      const handleClick = useCallback(() => {
        markerModelService.handleItemClick(props.item);
      }, [markerModelService]);

      return (
        <MarkerNodeRendered
          item={props.item}
          itemType={props.itemType}
          decorations={markerModelService.decorations.getDecorations(props.item as any)}
          defaultLeftPadding={8}
          onClick={handleClick}
          leftPadding={8}
        />
      );
    },
    [model],
  );
  if (!model) {
    return <div className={styles.empty}>{Messages.markerPanelContentEmpty()}</div>;
  } else {
    return (
      <RecycleTree
        height={viewState.height}
        itemHeight={MARKER_TREE_NODE_HEIGHT}
        supportDynamicHeights={true}
        onReady={handleTreeReady}
        model={model}
        placeholder={() => <Empty />}
      >
        {renderTreeNode}
      </RecycleTree>
    );
  }
};

/**
 * empty marker
 */
const Empty: FC = () => {
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
};

/**
 * marker panel
 */
export const MarkerPanel = ({ viewState }: { viewState: ViewState }) => {
  const markerModelService = useInjectable<MarkerModelService>(MarkerModelService);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const handleOuterClick = useCallback(() => {
    // 空白区域点击，取消焦点状态
    const { enactiveNodeDecoration } = markerModelService;
    enactiveNodeDecoration();
  }, [markerModelService]);

  useEffect(() => {
    const handleBlur = () => {
      markerModelService.handleTreeBlur();
    };
    wrapperRef.current?.addEventListener('blur', handleBlur, true);
    return () => {
      wrapperRef.current?.removeEventListener('blur', handleBlur, true);
      markerModelService.handleTreeBlur();
    };
  }, [wrapperRef.current]);

  return (
    <div className={styles.markersContent} tabIndex={-1} ref={wrapperRef} onClick={handleOuterClick}>
      <MarkerList viewState={viewState} />
    </div>
  );
};
