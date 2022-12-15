import React, { useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { Scrollbars } from '../scrollbars';

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
    // 暂时还无法应用这个 Scrollbars 上下边界样式（阴影效果）
    // 因为 Virtuoso 的 scroll 事件没有传给 Scrollbars
    // 此处用于展示虚拟的滑动条而不是浏览器绘制的滑动条
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
        itemContent={(i, d) => <ItemTemplate index={i} data={d} />}
      />
    </Scrollbars>
  );
};
