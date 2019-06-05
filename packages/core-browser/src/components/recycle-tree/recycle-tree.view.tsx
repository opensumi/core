import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { TreeProps } from '../tree';
import { PerfectScrollbar, TreeContainer } from '@ali/ide-core-browser/lib/components';

export interface RecycleTreeProps extends TreeProps {
  scrollContentStyle: React.CSSProperties;
  scrollbarStyle: React.CSSProperties;
  onScrollUp?: any;
  onScrollDown?: any;
  onScrollLeft?: any;
  onScrollRight?: any;
}

export const RecycleTree = observer((
  {
    nodes,
    scrollbarStyle,
    scrollContentStyle,
    onScrollUp,
    onScrollDown,
    onScrollLeft,
    onScrollRight,
    onContextMenu,
    onDragStart,
    onSelect,
  }: RecycleTreeProps,
) => {
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
              nodes={ nodes }
              onContextMenu={ onContextMenu }
              onDragStart={ onDragStart }
              onSelect={ onSelect }/>
          </div>
    </PerfectScrollbar>
  </React.Fragment>;
});
