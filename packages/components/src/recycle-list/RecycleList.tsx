import * as React from 'react';
import { FixedSizeList, VariableSizeList } from 'react-window';
import { ScrollbarsVirtualList } from '../scrollbars';
import AutoSizer from 'react-virtualized-auto-sizer';
import * as cls from 'classnames';

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
   * 处理 RecycleList API回调
   * @memberof IRecycleListProps
   */
  onReady?: (api: IRecycleListHandler) => void;
}

export interface IRecycleListHandler {
  scrollTo: (offset: number) => void;
  scrollToIndex: (index: number) => void;
}

export const DynamicListContext = React.createContext<
  Partial<{ setSize: (index: number, size: number) => void }>
>({});

export class RecycleList extends React.Component<IRecycleListProps> {

  private static STABILIZATION_TIME: number = 500;

  private listRef;
  private sizeMap;
  private scrollToIndexTimer;

  constructor(props) {
    super(props);
    this.listRef = React.createRef<FixedSizeList>();
    this.sizeMap = React.createRef<{ [key: string]: number }>();
    this.scrollToIndexTimer = React.createRef<any>();
    this.sizeMap.current = {};
  }

  private setSize = (index: number, size: number) => {
    if (this.sizeMap.current[index] !== size) {
      this.sizeMap.current = { ...this.sizeMap.current, [index]: size };
      if (this.listRef.current) {
        // 清理缓存数据并重新渲染
        this.listRef.current.resetAfterIndex(0);
      }
    }
  }

  private getSize = (index: number) => {
    return this.sizeMap?.current[index] || 100;
  }

  public componentDidMount() {
    const { onReady, header, itemHeight } = this.props;
    if (typeof onReady === 'function') {
      const api = {
        scrollTo: (offset: number) => {
          this.listRef.current?.scrollTo(offset);
        },
        // custom alignment: center, start, or end
        scrollToIndex: (index: number, position: string = 'start') => {
          let locationIndex = index;
          if (!!header) {
            locationIndex++;
          }
          if (typeof itemHeight === 'number') {
            this.listRef.current?.scrollTo(locationIndex * (itemHeight), position);
          } else {
            if (this.scrollToIndexTimer.current) {
              clearTimeout(this.scrollToIndexTimer.current);
            }
            const keys = this.sizeMap.current ? Object.keys(this.sizeMap.current) : [];
            const offset = keys.slice(0, locationIndex).reduce((p, i) => p + this.getSize(index), 0);
            this.listRef.current?.scrollToItem(index, position);
            // 在动态列表情况下，由于渲染抖动问题，可能需要再渲染后尝试再进行一次滚动位置定位
            this.scrollToIndexTimer.current = setTimeout(() => {
              const keys = this.sizeMap.current ? Object.keys(this.sizeMap.current) : [];
              const nextOffset = keys.slice(0, locationIndex).reduce((p, i) => p + this.getSize(index), 0);
              if (nextOffset !== offset) {
                this.listRef.current?.scrollToItem(index, position);
              }
              this.scrollToIndexTimer.current = null;
            }, RecycleList.STABILIZATION_TIME);
          }
        },
      };
      onReady(api);
    }
  }

  private get adjustedRowCount() {
    const { data, header, footer } = this.props;
    let count = data.length;
    if (!!header) {
      count++;
    }
    if (!!footer) {
      count++;
    }
    return count;
  }

  private renderItem = ({ index, style }): JSX.Element => {
    const { data, template: Template, header: Header, footer: Footer } = this.props;
    let node;
    if (index === 0) {
      if (Header) {
        return <div style={style}>
          <Header />
        </div>;
      }
    }
    if ((index + 1) === this.adjustedRowCount) {
      if (!!Footer) {
        return <div style={style}>
          <Footer />
        </div>;
      }
    }
    if (!!Header) {
      node = data[index - 1];
    } else {
      node = data[index];
    }
    if (!node) {
      return <div style={style}></div>;
    }
    return <div style={style}>
      <Template data={node} index={index} />
    </div>;
  }

  private getItemKey = (index: number) => {
    const { data } = this.props;
    const node = data[index];
    if (node && node.id) {
      return node.id;
    }
    return index;
  }

  // 通过计算平均行高来提高准确性
  // 修复滚动条行为，见: https://github.com/bvaughn/react-window/issues/408
  private calcEstimatedSize() {
    const keys = this.sizeMap.current ? Object.keys(this.sizeMap.current) : [];
    const estimatedHeight = keys.reduce((p, i) => p + this.sizeMap.current[i], 0);
    return estimatedHeight / keys.length;
  }

  public render() {
    const {
      itemHeight,
      style,
      className,
      width,
      height,
    } = this.props;
    let List;
    if (typeof itemHeight === 'number') {
      List = FixedSizeList;
    } else {
      List = VariableSizeList;
    }
    if (width && height) {
      return (<List
        width={width}
        height={height}
        // 这里的数据不是必要的，主要用于在每次更新列表
        itemData={[]}
        itemSize={itemHeight}
        itemCount={this.adjustedRowCount}
        getItemKey={this.getItemKey}
        overscanCount={10}
        ref={this.listRef}
        style={style}
        className={cls(className, 'kt-recycle-list')}
        outerElementType={ScrollbarsVirtualList}>
        {this.renderItem}
      </List>);
    }

    return <DynamicListContext.Provider value={{ setSize: this.setSize }}>
      <AutoSizer>
        {({ height, width }) => (
          <List
            width={width}
            height={height}
            // 这里的数据不是必要的，主要用于在每次更新列表
            itemData={[]}
            itemSize={this.getSize}
            itemCount={this.adjustedRowCount}
            getItemKey={this.getItemKey}
            overscanCount={10}
            ref={this.listRef}
            style={style}
            className={cls(className, 'kt-recycle-list')}
            outerElementType={ScrollbarsVirtualList}
            estimatedItemSize={this.calcEstimatedSize()}>
            {this.renderItem}
          </List>
        )}
      </AutoSizer>
    </DynamicListContext.Provider>;
  }
}
