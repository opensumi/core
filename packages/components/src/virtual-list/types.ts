import { ListRange, VirtuosoHandle } from 'react-virtuoso';

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
   * 整个 List 的样式名
   * @type {string}
   */
  className?: string;
  refSetter?: (virtuoso: IVirtualListHandle | null) => void;
  onRangeChanged?: (range: IVirtualListRange) => void;
}
