import React, { useEffect, useRef } from 'react';
import { ScrollerProps, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

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
  );
};
