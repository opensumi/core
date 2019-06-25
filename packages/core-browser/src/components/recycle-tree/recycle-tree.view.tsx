import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { TreeProps, TreeContainer } from '../tree';
import { PerfectScrollbar } from '../scrollbar';

export interface RecycleTreeProps extends TreeProps {
  scrollContentStyle: React.CSSProperties;
  scrollbarStyle: React.CSSProperties;
  onScrollUp?: any;
  onScrollDown?: any;
  onScrollLeft?: any;
  onScrollRight?: any;
  dataProvider?: any;
}

export const RecycleTree = (
  {
    nodes,
    multiSelect,
    dataProvider,
    scrollbarStyle,
    scrollContentStyle,
    onScrollUp,
    onScrollDown,
    onScrollLeft,
    onScrollRight,
    onContextMenu,
    onDrag,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDragEnd,
    onDrop,
    onChange,
    draggable,
    editable,
    onSelect,
  }: RecycleTreeProps,
) => {
  const noop = () => {};
  return <React.Fragment>
    <PerfectScrollbar
      style={ scrollbarStyle }
      onScrollUp={ onScrollUp }
      onScrollDown={ onScrollDown }
      onScrollLeft={ onScrollLeft }
      onScrollRight={ onScrollRight }
      >
          <div style={ scrollContentStyle }>
            <TreeContainer
              multiSelect={ multiSelect }
              nodes={ nodes || dataProvider() }
              onContextMenu={ onContextMenu }
              onDrag={ onDrag || noop }
              onDragStart={ onDragStart || noop }
              onDragEnter={ onDragEnter || noop }
              onDragOver={ onDragOver || noop }
              onDragLeave={ onDragLeave || noop }
              onDragEnd={ onDragEnd || noop }
              onChange= { onChange || noop }
              onDrop={ onDrop || noop }
              draggable={ draggable }
              onSelect={ onSelect }
              editable={ editable }/>
          </div>
    </PerfectScrollbar>
  </React.Fragment>;
};
