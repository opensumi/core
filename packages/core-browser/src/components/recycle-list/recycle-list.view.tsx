import React from 'react';
import styles from './recycle-list.module.less';
import cls from 'classnames';
import { InfinityList } from '../list';

export interface RecycleListProp extends React.PropsWithChildren<any> {
  /**
   * 渲染列表项的React组件，渲染时数据会通过props方式传入
   */
  template: any;
  /**
   * 容器样式名
   */
  className?: string;
  /**
   * 容器样式
   */
  style?: React.CSSProperties;
  /**
   * 渲染的列表数据
   */
  data: any[];
  /**
   * 列表表头
   */
  header?: {
    title: string;
    classname?: string;
  }[];
  /**
   * 列表头部样式
   */
  headerClass?: string;
  /**
   * 列表key字段，从data[keyProp]取值
   */
  keyProp?: string;
  /**
   * loading及底部渲染组件
   */
  placeholders?: any;
  /**
   * 是否为loading状态
   */
  isLoading?: boolean;
  /**
   * 是否在底部/顶部状态
   */
  isDrained?: boolean;
  /**
   * 数据切分大小
   */
  sliceSize?: number;
  /**
   * 数据加载更多校验边界
   */
  sliceThreshold?: number;
  /**
   * 加载事件函数
   */
  onLoad?: any;
  /**
   * 是否在数据更新时滚动到底部
   */
  scrollBottomIfActive?: boolean;
}

export const RecycleList = ({
  template,
  className = '',
  style,
  data,
  keyProp = 'id',
  placeholders = {},
  isLoading = false,
  isDrained = false,
  sliceSize = 30,
  sliceThreshold = 30,
  header = [],
  headerClass = '',
  scrollBottomIfActive = false,
  onLoad = () => { },
}: RecycleListProp) => {

  const getContainer = (ref) => {
    return ref;
  };

  const renderHeader = (header) => {
    if (header && header.length > 0) {
      return <div className={cls(styles.recycle_list_header, headerClass)}>
        {header.map((head) => {
          return <div className={cls(styles.recycle_list_header_item, head.classname)} key={head.title}>{head.title}</div>;
        })}
      </div>;
    }
  };

  return <div className={styles.recycle_list_conatainer}>
    {renderHeader(header)}
    <InfinityList
      template={template}
      getContainer={getContainer}
      className={className}
      style={style}
      data={data}
      keyProp={keyProp}
      placeholders={placeholders}
      isLoading={isLoading}
      isDrained={isDrained}
      sliceSize={sliceSize}
      sliceThreshold={sliceThreshold}
      onLoad={onLoad}
      scrollBottomIfActive={scrollBottomIfActive}
    />
  </div>;
};
