import React from 'react';
import cls from 'classnames';
import styles from './infinity-list.module.less';
import { PerfectScrollbar } from '../scrollbar';
import throttle = require('lodash.throttle');

const VISIBLE_SLICE_COUNT = 3;

const getSlices = (data, sliceSize) => {
  const slices: any[] = [];
  for (let i = 0, amount = data.length; amount >= 0; i++ , amount -= sliceSize) {
    slices.push({
      startIndex: sliceSize * i,
      amount: amount > sliceSize ? sliceSize : amount,
    });
  }
  return slices;
};

export interface InfinityListProp {
  // 渲染模板
  template?: any;
  // 样式名
  className?: string;
  // 样式
  style?: React.CSSProperties;
  // 数据源
  data: any[];
  // 用于渲染template时从data中获取key属性字段
  keyProp: string;
  // 加载函数
  onLoad?: any;
  // 是否在加载中
  isLoading: boolean;
  // 是否到达底部
  isDrained: boolean;
  // 预加载loading内容
  placeholders: {
    // loading加载内容
    loading: React.Component;
    // 到达底部渲染内容
    drained: React.Component;
  };
  // 获取容器高度
  getContainer: any;
  // 切割渲染片段的粒度
  sliceSize: number;
  // 渲染片段切换的边界条件（距离 containerEL ${sliceThreshold}px）
  sliceThreshold: number;
  // 是否自动对齐到滚动条底部
  scrollBottomIfActive: boolean;
}

interface InfinityListState {
  prevProps: {
    data: any[];
  };
  slices: any[];
  currentSliceIndex: number;
  topSpaces: any[];
  bottomSpaces: any[];
  isScrolled: boolean;
}

const defaultInfinityListState = {
  prevProps: {
    data: [],
  },
  slices: [],
  currentSliceIndex: 0,
  topSpaces: [],
  bottomSpaces: [],
  isScrolled: false,
};

/**
 * 实现不关注列表高度的无限列表组件
 */
export class InfinityList extends React.Component<InfinityListProp, InfinityListState> {
  static defaultProps = {
    keyProp: 'id',
    placeholders: {},
    sliceSize: 30,
    sliceThreshold: 30,
    isScrolled: false,
  };

  static getDerivedStateFromProps(props, state) {
    const { prevProps, isScrolled } = state;
    const { data, sliceSize, scrollBottomIfActive } = props;
    const { data: prevData } = prevProps;

    const slices = getSlices(data, sliceSize);

    // 数据源未发生变化
    if (prevData === data) {
      return null;
    }

    // 当新数据大小小于分片数据大小时，清空状态
    if (slices.length < VISIBLE_SLICE_COUNT) {
      return {
        slices,
        currentSliceIndex: 0,
        topSpaces: [],
        bottomSpaces: [],
        prevProps: {
          data,
        },
      };
    }
    // 数据更新或被裁剪
    if (data.length !== prevData.length) {
      if (scrollBottomIfActive && !isScrolled) {
        return {
          slices,
          currentSliceIndex: slices.length - VISIBLE_SLICE_COUNT,
          prevProps: {
            data,
          },
        };
      } else {
        return {
          slices,
          currentSliceIndex: 0,
          prevProps: {
            data,
          },
        };
      }
    }
    // 记录数据源
    return {
      slices,
      prevProps: {
        data,
      },
    };
  }

  private listEl: any;
  private rootEl: any;
  private scrollBarEl: any;
  private topBoundary: any;
  private nextBoundary: any;
  private placeholderEl: any;

  private processing: boolean = false;

  private observer: IntersectionObserver | null;

  readonly state: InfinityListState = defaultInfinityListState;

  private scrollToBottom = throttle(() => {
    // 滚动到底部前预先更新滚动条
    if (this.scrollBarEl && this.scrollBarEl.updateScroll) {
      this.scrollBarEl.updateScroll();
    }
    this.containerEl.scrollTop = this.containerEl.children[0].offsetHeight;
  }, 500);

  componentDidMount() {
    const { isDrained } = this.props;

    if (this.shouldOptimize) {
      this.bindBoundaryEls();
    }

    if (isDrained) {
      return;
    }

    this.startObserve();
  }

  componentDidUpdate(prevProps) {
    const { data: oldData, isDrained: wasDrained } = prevProps;
    const { isLoading, isDrained, data, scrollBottomIfActive } = this.props;

    if (oldData.length !== data.length) {
      if (scrollBottomIfActive && data.length) {
        this.scrollToBottom();
      }
    } else if (oldData.length > data.length) {
      this.containerEl.scrollTop = 0;
    }

    if (this.shouldOptimize) {
      this.bindBoundaryEls();
    } else {
      this.unbindBoundaryEls();
    }

    if (isLoading) {
      return;
    }

    if (isDrained) {
      this.stopObserve();
      return;
    }

    if (wasDrained && !isDrained) {
      this.startObserve();
      return;
    }

    if (oldData.length < data.length) {
      this.mayLoadMore();
    }
  }

  componentWillUnmount() {
    this.stopObserve();
    this.unbindBoundaryEls();
  }

  get shouldOptimize() {
    const { slices } = this.state;
    return slices.length > VISIBLE_SLICE_COUNT;
  }

  get visibleData() {
    const { data } = this.props;
    if (!this.shouldOptimize) {
      return data;
    }

    if (this.shouldOptimize) {
      const { slices, currentSliceIndex } = this.state;
      const visibleSlices = slices.slice(
        currentSliceIndex,
        currentSliceIndex + VISIBLE_SLICE_COUNT,
      );
      const startIndex = visibleSlices[0].startIndex;
      const amount = visibleSlices.reduce(
        (amount, slice) => slice.amount + amount,
        0,
      );
      return data.slice(startIndex, startIndex + amount);
    }
  }

  get containerEl() {
    const { getContainer } = this.props;
    return (getContainer && getContainer(this.rootEl)) || document.body;
  }

  bindBoundaryEls = () => {
    const { slices, currentSliceIndex } = this.state;
    const nodeList = this.listEl.childNodes;
    this.topBoundary = nodeList[slices[currentSliceIndex].amount];
    this.nextBoundary =
      nodeList[
      slices[currentSliceIndex].amount +
      slices[currentSliceIndex + 1].amount -
      1
      ];
  }

  unbindBoundaryEls = () => {
    this.topBoundary = null;
    this.nextBoundary = null;
  }

  handleScroll = (event) => {
    if (!this.shouldOptimize || this.processing) {
      return;
    }

    if (!this.topBoundary || !this.nextBoundary) {
      return;
    }

    const { sliceThreshold } = this.props;
    const { slices, currentSliceIndex, topSpaces, bottomSpaces, isScrolled } = this.state;

    if (!isScrolled) {
      this.setState({
        isScrolled: true,
      });
    }
    const topBoundaryLoc = this.topBoundary.getBoundingClientRect().top;
    const nextBoundaryLoc = this.nextBoundary.getBoundingClientRect().bottom;

    const containerTop = this.containerEl.getBoundingClientRect().top;

    if (nextBoundaryLoc - containerTop < sliceThreshold) {
      this.processing = true;
      if (currentSliceIndex + VISIBLE_SLICE_COUNT < slices.length) {
        const startY = this.listEl.firstChild.getBoundingClientRect().top;
        const topSpace = topBoundaryLoc - startY;
        this.setState(
          {
            currentSliceIndex: currentSliceIndex + 1,
            topSpaces: topSpaces.concat(topSpace),
            bottomSpaces: bottomSpaces.slice(0, bottomSpaces.length - 1),
          },
          () => {
            this.bindBoundaryEls();
            this.processing = false;
          },
        );
      } else {
        // FIXME: 假定每个List分片高度都是均匀的, 单个分片高度如下
        const sliceHeight = nextBoundaryLoc - topBoundaryLoc;
        // list已加载到最大长度，固定顶部及底部
        this.setState(
          {
            topSpaces: new Array(slices.length - VISIBLE_SLICE_COUNT).fill(sliceHeight),
            bottomSpaces: [],
            isScrolled: false,
          },
          () => {
            this.bindBoundaryEls();
            this.processing = false;
          },
        );
      }

      return;
    }

    const containerHeight = this.containerEl.clientHeight;

    if (
      topBoundaryLoc > containerTop + containerHeight - sliceThreshold &&
      currentSliceIndex > 0
    ) {
      this.processing = true;
      this.setState(
        {
          currentSliceIndex: currentSliceIndex - 1,
          topSpaces: topSpaces.slice(0, topSpaces.length - 1),
          bottomSpaces: bottomSpaces.concat(topSpaces.slice(topSpaces.length - 1)),
        },
        () => {
          this.bindBoundaryEls();
          this.processing = false;
        },
      );
    }
  }

  mayLoadMore = () => {
    if (!this.placeholderEl || !this.containerEl) {
      return ;
    }
    const { top: containerY } = this.containerEl.getBoundingClientRect();
    const containerHeight = this.containerEl.clientHeight;
    const { top: placeholderY } =  this.placeholderEl.getBoundingClientRect();
    if (placeholderY <= containerHeight + containerY) {
      const { onLoad } = this.props;
      onLoad();
    }
  }

  handleObserve = ([entry]) => {
    if (!entry.isIntersecting) { return; }

    const { isLoading, isDrained, onLoad } = this.props;
    if (isLoading || isDrained) { return; }

    onLoad();
  }

  startObserve = () => {
    if (!this.placeholderEl) { return; }
    // 销毁已经存在的 Observer
    this.stopObserve();

    this.observer = new IntersectionObserver(this.handleObserve);
    this.observer.observe(this.placeholderEl);
  }

  stopObserve = () => {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  renderItem = (data, index) => {
    const { template: Template, keyProp } = this.props;
    return <Template data={data} index={index} key={data[keyProp]} />;
  }

  render() {
    const { className, style, placeholders, isDrained, isLoading } = this.props;
    const { topSpaces, bottomSpaces } = this.state;
    const scorllerBarOptions = {
      minScrollbarLength: 20,
    };
    return (
      <PerfectScrollbar
        className={cls(styles.infinity_container, className)}
        style={style}
        onScrollY={this.handleScroll}
        ref={(el) => (this.scrollBarEl = el)}
        containerRef={(el) => (this.rootEl = el)}
        options = {scorllerBarOptions}
      >
        <div
          ref={(el) => (this.listEl = el)}
          style={{
            paddingTop: `${topSpaces.reduce(
              (total, curr) => curr + total,
              0,
            )}px`,
            paddingBottom: `${bottomSpaces.reduce(
              (total, curr) => curr + total,
              0,
            )}px`,
          }}
        >
          {this.visibleData && this.visibleData.map(this.renderItem)}
        </div>
        {!isDrained && isLoading && (
          <div ref={(el) => (this.placeholderEl = el)}>
            {placeholders.loading}
          </div>
        )}
        {isDrained && placeholders.drained}
      </PerfectScrollbar>
    );
  }
}
