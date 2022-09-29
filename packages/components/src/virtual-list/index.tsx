import React, { useEffect, useRef } from 'react';
import { ListRange, Virtuoso, VirtuosoHandle } from 'react-virtuoso';

export type IVirtualListHandle = VirtuosoHandle;
export type IVirtualListRange = ListRange;

export interface IVirtualListProps {
  /**
   * List数据源
   * @type {any[]}
   */
  data: any[];
  /**
   * 基础数据源渲染模板
   * 默认传入参数为：(data, index) => {}
   * data 为 this.props.data中的子项
   * index 为当前下标
   * @type {React.ComponentType<any>}
   */
  template: React.ComponentType<any>;
  /**
   * List外部样式名
   * @type {string}
   */
  className?: string;
  refSetter?: (virtuoso: IVirtualListHandle | null) => void;

  onRangeChanged?: (range: IVirtualListRange) => void;
}

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
