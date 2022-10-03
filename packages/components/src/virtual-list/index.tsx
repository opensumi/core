import React, { useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Scrollbars, ScrollbarsVirtualList } from '../scrollbars';

import { IVirtualListProps } from './types';

export const VirtualList = ({
  data,
  className,
  template: ItemTemplate,
  refSetter,
  onRangeChanged,
}: IVirtualListProps) => {
  const virtuoso = useRef<VirtuosoHandle | null>(null);

  useEffect(() => {
    refSetter?.(virtuoso.current);
  }, [virtuoso.current]);

  return (
    // 暂时还无法用到这个 Scrollbars 上下边界样式的应用
    // 因为这样用似乎 Virtuoso 的 scroll 事件没有传给 Scrollbars
    // 但是虚拟的 Scrollbar 是有用的
    <Scrollbars>
      <Virtuoso
        rangeChanged={(range) => {
          onRangeChanged?.(range);
        }}
        overscan={5}
        ref={virtuoso}
        style={{ height: '100%' }}
        className={className}
        data={data}
        itemContent={(index, d) => <ItemTemplate data={d} index={index} />}
      />
    </Scrollbars>
  );
};
