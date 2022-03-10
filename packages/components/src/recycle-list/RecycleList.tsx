import cls from 'classnames';
import React from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, VariableSizeList, Align } from 'react-window';

import { ScrollbarsVirtualList } from '../scrollbars';

export interface IRecycleListProps {
  /**
   * 容器高度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  height?: number;
  /**
   * 容器宽度
   * height 计算出可视区域渲染数量
   * @type {number}
   * @memberof RecycleTreeProps
   */
  width?: number;
  /**
   * 最大容器高度
   * 当容器内容高度大于该值时列表将不再增长，而是出现滚动条
   * maxHeight 匹配优先级高于 height 属性
   * @type {number}
   * @memberof RecycleTreeProps
   */
  maxHeight?: number;
  /**
   * 最小容器高度
   * 当容器内容高度小于该值时将不再收缩，而是固定高度，一般需要配合 maxHeight一起使用
   * maxHeight 匹配优先级高于 height 属性
   * @type {number}
   * @memberof RecycleTreeProps
   */
  minHeight?: number;
  /**
   * 节点高度
   * @type {number}
   * @memberof RecycleTreeProps
   */
  itemHeight?: number;
  /**
   * List外部样式
   * @type {React.CSSProperties}
   * @memberof RecycleListProps
   */
  style?: React.CSSProperties;
  /**
   * List外部样式名
   * @type {string}
   * @memberof RecycleListProps
   */
  className?: string;
  /**
   * List数据源
   * @type {any[]}
   * @memberof IRecycleListProps
   */
  data: any[];
  /**
   * 基础数据源渲染模板
   * 默认传入参数为：(data, index) => {}
   * data 为 this.props.data中的子项
   * index 为当前下标
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  template: React.ComponentType<any>;
  /**
   * 头部组件渲染模板
   * 默认传入参数为：() => {}
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  header?: React.ComponentType<any>;
  /**
   * 底部组件渲染模板
   * 默认传入参数为：() => {}
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  footer?: React.ComponentType<any>;
  /**
   * List 底部边距大小，默认值为 0
   * @type {React.ComponentType<any>}
   * @memberof IRecycleListProps
   */
  paddingBottomSize?: number;
  /**
   * 处理 RecycleList API回调
   * @memberof IRecycleListProps
   */
  onReady?: (api: IRecycleListHandler) => void;
  /**
   * 如果为不定高 Item 时可以指定动态获取 item Size
   * https://react-window.vercel.app/#/examples/list/variable-size
   */
  getSize?: (index: number) => number;
}

export interface IRecycleListHandler {
  scrollTo: (offset: number) => void;
  scrollToIndex: (index: number, position?: Align) => void;
}

export const RECYCLE_LIST_STABILIZATION_TIME = 500;
export const RECYCLE_LIST_OVER_SCAN_COUNT = 50;

export const RecycleList: React.FC<IRecycleListProps> = ({
  width,
  height,
  maxHeight,
  minHeight,
  className,
  style,
  data,
  onReady,
  itemHeight,
  header: Header,
  footer: Footer,
  template: Template,
  paddingBottomSize,
  getSize: customGetSize,
}) => {
  const listRef = React.useRef<FixedSizeList | VariableSizeList>();
  const sizeMap = React.useRef<{ [key: string]: number }>({});
  const scrollToIndexTimer = React.useRef<any>();

  React.useEffect(() => {
    if (typeof onReady === 'function') {
      const api = {
        scrollTo: (offset: number) => {
          listRef.current?.scrollTo(offset);
        },
        // custom alignment: center, start, or end
        scrollToIndex: (index: number, position: Align = 'start') => {
          let locationIndex = index;
          if (Header) {
            locationIndex++;
          }
          if (typeof itemHeight === 'number') {
            listRef.current?.scrollToItem(locationIndex, position);
          } else {
            if (scrollToIndexTimer.current) {
              clearTimeout(scrollToIndexTimer.current);
            }
            const keys = sizeMap.current ? Object.keys(sizeMap.current) : [];
            const offset = keys.slice(0, locationIndex).reduce((p, i) => p + getSize(i), 0);
            listRef.current?.scrollToItem(index, position);
            // 在动态列表情况下，由于渲染抖动问题，可能需要再渲染后尝试再进行一次滚动位置定位
            scrollToIndexTimer.current = setTimeout(() => {
              const keys = sizeMap.current ? Object.keys(sizeMap.current) : [];
              const nextOffset = keys.slice(0, locationIndex).reduce((p, i) => p + getSize(i), 0);
              if (nextOffset !== offset) {
                listRef.current?.scrollToItem(index, position);
              }
              scrollToIndexTimer.current = null;
            }, RECYCLE_LIST_STABILIZATION_TIME);
          }
        },
      };
      onReady(api);
    }
  }, []);

  const setSize = (index: number, size: number) => {
    if (sizeMap.current[index] !== size) {
      sizeMap.current = { ...sizeMap.current, [index]: size };
      if (listRef.current) {
        // 清理缓存数据并重新渲染
        (listRef.current as VariableSizeList<any>)?.resetAfterIndex(0);
      }
    }
  };

  const getSize = React.useCallback(
    (index: string | number) => {
      if (customGetSize) {
        return customGetSize(Number(index));
      }
      return (sizeMap?.current || [])[index] || itemHeight || 100;
    },
    [itemHeight, customGetSize],
  );

  const getMaxListHeight = React.useCallback(() => {
    if (maxHeight) {
      let height = 0;
      for (let i = 0; i < data.length; i++) {
        height += getSize(i);
      }
      if (height > maxHeight) {
        return maxHeight;
      } else {
        return height;
      }
    }
  }, [maxHeight, data]);

  const getMinListHeight = React.useCallback(() => {
    if (minHeight) {
      return minHeight;
    }
  }, [minHeight, data]);

  const adjustedRowCount = React.useMemo(() => {
    let count = data.length;
    if (Header) {
      count++;
    }
    if (Footer) {
      count++;
    }
    return count;
  }, [data]);

  const renderItem = ({ index, style }): JSX.Element => {
    let node;
    if (index === 0) {
      if (Header) {
        return (
          <div style={style}>
            <Header />
          </div>
        );
      }
    }
    if (index + 1 === adjustedRowCount) {
      if (Footer) {
        return (
          <div style={style}>
            <Footer />
          </div>
        );
      }
    }
    if (Header) {
      node = data[index - 1];
    } else {
      node = data[index];
    }
    if (!node) {
      return <div style={style}></div>;
    }

    // ref: https://developers.google.com/web/fundamentals/accessibility/semantics-aria/aria-labels-and-relationships
    const ariaInfo = {
      'aria-setsize': adjustedRowCount,
      'aria-posinset': index,
    };

    return (
      <div style={style} role='listitem' {...ariaInfo}>
        <Template data={node} index={index} />
      </div>
    );
  };

  const renderDynamicItem = ({ index, style }): JSX.Element => {
    const rowRoot = React.useRef<null | HTMLDivElement>(null);
    const observer = React.useRef<any>();
    const setItemSize = () => {
      if (rowRoot.current) {
        let height = 0;
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < rowRoot.current.children.length; i++) {
          height += rowRoot.current.children[i].getBoundingClientRect().height;
        }
        setSize(index, height);
      }
    };
    React.useEffect(() => {
      if (rowRoot.current && listRef.current) {
        observer.current = new MutationObserver((mutations, observer) => {
          setItemSize();
        });
        const observerOption = {
          childList: true, // 子节点的变动（新增、删除或者更改）
          attributes: true, // 属性的变动
          characterData: true, // 节点内容或节点文本的变动

          attributeFilter: ['class', 'style'], // 观察特定属性
          attributeOldValue: true, // 观察 attributes 变动时，是否需要记录变动前的属性值
          characterDataOldValue: true, // 观察 characterData 变动，是否需要记录变动前的值
        };
        // 监听子节点属性变化
        observer.current.observe(rowRoot.current, observerOption);
        setItemSize();
      }
      return () => {
        observer.current.disconnect();
      };
    }, [rowRoot.current]);
    let node;
    if (index === 0) {
      if (Header) {
        return (
          <div style={style}>
            <Header />
          </div>
        );
      }
    }
    if (index + 1 === adjustedRowCount) {
      if (Footer) {
        return (
          <div style={style}>
            <Footer />
          </div>
        );
      }
    }
    if (Header) {
      node = data[index - 1];
    } else {
      node = data[index];
    }
    if (!node) {
      return <div style={style}></div>;
    }

    return (
      <div style={style} ref={rowRoot}>
        <Template data={node} index={index} />
      </div>
    );
  };

  const getItemKey = (index: number) => {
    const node = data[index];
    if (node && node.id) {
      return node.id;
    }
    return index;
  };

  // 通过计算平均行高来提高准确性
  // 修复滚动条行为，见: https://github.com/bvaughn/react-window/issues/408
  const calcEstimatedSize = React.useMemo(() => {
    const estimatedHeight = data.reduce((p, i) => p + getSize(i), 0);
    return estimatedHeight / data.length;
  }, [data]);

  // 为 List 添加下边距
  const InnerElementType = React.forwardRef((props, ref) => {
    const { style, ...rest } = props as any;
    return (
      <div
        ref={ref!}
        style={{
          ...style,
          height: `${parseFloat(style.height) + (paddingBottomSize ? paddingBottomSize : 0)}px`,
        }}
        {...rest}
      />
    );
  });

  const render = () => {
    const isDynamicList = typeof itemHeight !== 'number';
    const isAutoSizeList = !width || !height;

    const renderList = () => {
      let List;
      if (!isDynamicList) {
        List = FixedSizeList;
      } else {
        List = VariableSizeList;
      }

      const renderContent = ({ width, height }) => {
        const maxH = getMaxListHeight();
        const minH = getMinListHeight();
        let currentHeight = height;
        if (minH) {
          currentHeight = Math.min(height, minH);
        } else if (maxH) {
          currentHeight = maxH;
        }
        if (isDynamicList) {
          return (
            <List
              width={width}
              height={currentHeight}
              // 这里的数据不是必要的，主要用于在每次更新列表
              itemData={[]}
              itemSize={getSize}
              itemCount={adjustedRowCount}
              getItemKey={getItemKey}
              overscanCount={RECYCLE_LIST_OVER_SCAN_COUNT}
              ref={listRef}
              style={{
                transform: 'translate3d(0px, 0px, 0px)',
                ...style,
              }}
              className={cls(className, 'kt-recycle-list')}
              innerElementType={InnerElementType}
              outerElementType={ScrollbarsVirtualList}
              estimatedItemSize={calcEstimatedSize}
            >
              {renderDynamicItem}
            </List>
          );
        } else {
          return (
            <List
              width={width}
              height={currentHeight}
              // 这里的数据不是必要的，主要用于在每次更新列表
              itemData={[]}
              itemSize={itemHeight}
              itemCount={adjustedRowCount}
              getItemKey={getItemKey}
              overscanCount={RECYCLE_LIST_OVER_SCAN_COUNT}
              ref={listRef}
              style={{
                transform: 'translate3d(0px, 0px, 0px)',
                ...style,
              }}
              className={cls(className, 'kt-recycle-list')}
              innerElementType={InnerElementType}
              outerElementType={ScrollbarsVirtualList}
            >
              {renderItem}
            </List>
          );
        }
      };

      if (!isAutoSizeList) {
        return renderContent({ width, height });
      } else {
        return <AutoSizer>{renderContent}</AutoSizer>;
      }
    };

    return renderList();
  };

  return render();
};
