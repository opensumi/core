import * as React from 'react';
import { TreeProps, TreeContainer, TreeNode } from '../tree';
import { PerfectScrollbar } from '../scrollbar';
import throttle = require('lodash.throttle');

export interface RecycleTreeProps extends TreeProps {
  // 滚动内容高度，包括不可见的内容高度（必须包含宽高）
  scrollContentStyle?: {
    width: number;
    height: number;
    [key: string]: string | number | boolean | undefined
  };
  // 滚动容器布局（必须包含宽高）
  scrollContainerStyle: {
    width: number;
    height: number;
    [key: string]: string | number | boolean | undefined
  };
  // 缩进大小
  leftPadding?: number;
  // 默认顶部高度
  scrollTop?: number;
  // 预加载数量
  prerenderNumber?: number;
  // 容器内展示的节点数量
  // 一般为 Math.ceil(容器高度/节点高度)
  contentNumber: number;
  // 节点高度
  itemLineHeight?: number;
  // 搜索字符串
  search?: string;
  // 替换字符串
  replace?: string;
}

export const RecycleTree = (
  {
    nodes,
    leftPadding,
    multiSelectable,
    scrollContainerStyle,
    scrollContentStyle,
    onContextMenu,
    onDrag,
    onDragStart,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDragEnd,
    onDrop,
    onChange,
    draggable,
    foldable,
    editable,
    searchable,
    search,
    replace,
    onSelect,
    scrollTop,
    prerenderNumber = 20,
    contentNumber,
    itemLineHeight = 22,
    actions,
    commandActuator,
  }: RecycleTreeProps,
) => {
  const noop = () => { };
  const [scrollRef, setScrollRef] = React.useState<HTMLDivElement>();
  const [renderedStart, setRenderedStart] = React.useState(0);
  const renderedEnd: number = renderedStart + contentNumber + prerenderNumber;
  // 预加载因子
  const preFactor = 2 / 3;
  const upPrerenderNumber = Math.ceil(prerenderNumber * preFactor);

  React.useEffect(() => {
    if (typeof scrollTop === 'number' && scrollRef) {
      scrollRef.scrollTop = scrollTop;
    }
    setRenderedStart(scrollTop ? Math.ceil(scrollTop / itemLineHeight) : 0);
  }, [scrollTop]);

  const renderNodes = React.useMemo((): TreeNode[] => {
    let renderedFileItems = nodes!.filter((item: TreeNode, index: number) => {
      return renderedStart <= index && index <= renderedEnd;
    });
    renderedFileItems = renderedFileItems.map((item: TreeNode, index: number) => {
      let highLightRange = item.highLightRange;
      if (!highLightRange && searchable && search) {
        const start = item.name.indexOf(search);
        let end;
        if (start >= 0) {
          end = start + search.length;
          highLightRange = {
            start,
            end,
          };
        }
      }
      return {
        ...item,
        order: renderedStart + index,
        highLightRange,
        replace,
      };
    });
    return renderedFileItems;
  }, [nodes, renderedStart ]);

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / itemLineHeight);
    if (positionIndex > upPrerenderNumber) {
      setRenderedStart(positionIndex - upPrerenderNumber);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollUpThrottledHandler = throttle(scrollUpHanlder, 200);

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.ceil(element.scrollTop / itemLineHeight);
    if (positionIndex > (prerenderNumber - upPrerenderNumber)) {
      setRenderedStart(positionIndex - (prerenderNumber - upPrerenderNumber));
    } else {
      setRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = throttle(scrollDownHanlder, 200);

  const contentStyle = scrollContentStyle || {
    width: scrollContainerStyle.width,
    height: nodes.length * itemLineHeight || 0,
  };
  return <React.Fragment>
    <PerfectScrollbar
      style={ scrollContainerStyle }
      onScrollUp={scrollUpThrottledHandler}
      onScrollDown={scrollDownThrottledHandler}
      containerRef={(ref) => {
        setScrollRef(ref);
      }}
    >
      <div style={ contentStyle }>
        <TreeContainer
          multiSelectable={ multiSelectable }
          nodes={ renderNodes }
          actions={ actions }
          commandActuator={ commandActuator }
          leftPadding={ leftPadding }
          onContextMenu={ onContextMenu }
          onDrag={ onDrag || noop }
          onDragStart={ onDragStart || noop }
          onDragEnter={ onDragEnter || noop }
          onDragOver={ onDragOver || noop }
          onDragLeave={ onDragLeave || noop }
          onDragEnd={ onDragEnd || noop }
          onChange={ onChange || noop }
          onDrop={ onDrop || noop }
          draggable={ draggable }
          onSelect={ onSelect }
          foldable={ foldable }
          replace={ replace }
          editable={ editable } />
      </div>
    </PerfectScrollbar>
  </React.Fragment>;
};

RecycleTree.displayName = 'RecycleTree';
