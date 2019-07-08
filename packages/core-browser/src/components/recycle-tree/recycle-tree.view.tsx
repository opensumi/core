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
  scrollTop?: number;
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
    scrollTop,
  }: RecycleTreeProps,
) => {
  const noop = () => {};
  const [scrollRef, setScrollRef] = React.useState<HTMLDivElement>();
  React.useEffect(() => {
    if (typeof scrollTop === 'number' && scrollRef) {
      scrollRef.scrollTop = scrollTop;
    }
  }, [scrollTop]);

  return <React.Fragment>
    <PerfectScrollbar
      style={ scrollbarStyle }
      onScrollUp={ onScrollUp }
      onScrollDown={ onScrollDown }
      onScrollLeft={ onScrollLeft }
      onScrollRight={ onScrollRight }
      containerRef={ (ref) => {
        setScrollRef(ref);
      }}
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
