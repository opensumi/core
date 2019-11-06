import * as React from 'react';
import { TreeProps, TreeContainer, TreeNode } from '../tree';
import { PerfectScrollbar } from '../scrollbar';

export interface RecycleTreeProps extends TreeProps {
  /**
   * 滚动内容样式，包括不可见区域
   *
   * @type {({
   *     [key: string]: string | number | boolean | undefined,
   *   })}
   * @memberof RecycleTreeProps
   */
  scrollContentStyle?: {
    [key: string]: string | number | boolean | undefined,
  };
  /**
   * 可视区域样式 (必须包含宽高用于初始化视图)
   *
   * @type {({
   *     width: number | string;
   *     height: number | string;
   *     [key: string]: string | number | boolean | undefined,
   *   })}
   * @memberof RecycleTreeProps
   */
  scrollContainerStyle: {
    width: number | string;
    height: number | string;
    [key: string]: string | number | boolean | undefined,
  };
  /**
   * 缩进大小
   *
   * @type {number}
   * @memberof RecycleTreeProps
   */
  leftPadding?: number;
  /**
   * 默认顶部高度
   *
   * @type {number}
   * @memberof RecycleTreeProps
   */
  scrollTop?: number;
  /**
   * 预加载数量, 默认值为 10
   *
   * @type {number}
   * @memberof RecycleTreeProps
   */
  prerenderNumber?: number;
  /**
   * 搜索字符串
   *
   * @type {string}
   * @memberof RecycleTreeProps
   */
  search?: string;
  /**
   * 替换的字符串，需配合search字段使用
   *
   * @type {string}
   * @memberof RecycleTreeProps
   */
  replace?: string;
  /**
   * 容器高度
   * RecycleTree配合 itemLineHeight 计算出可视区域渲染数量
   *
   * @type {number}
   * @memberof RecycleTreeProps
   */
  containerHeight: number;
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
    onBlur,
    onFocus,
    onTwistieClick,
    scrollTop,
    prerenderNumber = 10,
    containerHeight,
    itemLineHeight = 22,
    actions,
    commandActuator,
    fileDecorationProvider,
    themeProvider,
    notifyFileDecorationsChange,
    notifyThemeChange,
    validate,
  }: RecycleTreeProps,
) => {
  const noop = () => { };
  const contentNumber = Math.ceil(containerHeight / itemLineHeight);
  const [scrollRef, setScrollRef] = React.useState<HTMLDivElement>();
  const [renderedStart, setRenderedStart] = React.useState(0);
  const renderedEnd: number = renderedStart + contentNumber + prerenderNumber;
  // 预加载因子
  const preFactor = 3 / 4;
  const upPrerenderNumber = Math.floor(prerenderNumber * preFactor);
  React.useEffect(() => {
    if (typeof scrollTop === 'number' && scrollRef) {
      scrollRef.scrollTop = scrollTop;
    }
    setRenderedStart(scrollTop ? Math.floor(scrollTop / itemLineHeight) : 0);
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
  }, [nodes, renderedStart, scrollContainerStyle]);

  const scrollUpHanlder = (element: Element) => {
    const positionIndex = Math.floor(element.scrollTop / itemLineHeight);
    if (positionIndex > upPrerenderNumber) {
      setRenderedStart(positionIndex - upPrerenderNumber);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollUpThrottledHandler = (element: Element) => {
    requestAnimationFrame(() => {
      scrollUpHanlder(element);
    });
  };

  const scrollDownHanlder = (element: Element) => {
    const positionIndex = Math.floor(element.scrollTop / itemLineHeight);
    if (positionIndex > (prerenderNumber - upPrerenderNumber)) {
      setRenderedStart(positionIndex - (prerenderNumber - upPrerenderNumber));
    } else {
      setRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = (element: Element) => {
    requestAnimationFrame(() => {
      scrollDownHanlder(element);
    });
  };

  const contentStyle = scrollContentStyle || {
    width: '100%',
    height: nodes.length * itemLineHeight <= containerHeight ? containerHeight : nodes.length * itemLineHeight,
    userSelect: 'none',
  };

  return <React.Fragment>
    <PerfectScrollbar
      style={scrollContainerStyle}
      onScrollUp={scrollUpThrottledHandler}
      onScrollDown={scrollDownThrottledHandler}
      containerRef={(ref) => {
        setScrollRef(ref);
      }}
    >
      <TreeContainer
        style={contentStyle}
        multiSelectable={multiSelectable}
        itemLineHeight={itemLineHeight}
        nodes={renderNodes}
        actions={actions}
        commandActuator={commandActuator}
        leftPadding={leftPadding}
        onContextMenu={onContextMenu || noop}
        onDrag={onDrag || noop}
        onBlur={onBlur || noop}
        onFocus={onFocus || noop}
        onDragStart={onDragStart || noop}
        onDragEnter={onDragEnter || noop}
        onDragEnd={onDragEnd || noop}
        onDragOver={onDragOver || noop}
        onDragLeave={onDragLeave || noop}
        onChange={onChange || noop}
        onDrop={onDrop || noop}
        onSelect={onSelect || noop}
        onTwistieClick={onTwistieClick}
        draggable={draggable}
        foldable={foldable}
        replace={replace}
        editable={editable}
        fileDecorationProvider={fileDecorationProvider}
        themeProvider={themeProvider}
        notifyFileDecorationsChange={notifyFileDecorationsChange}
        notifyThemeChange={notifyThemeChange}
        validate={validate} />
    </PerfectScrollbar>
  </React.Fragment>;
};

RecycleTree.displayName = 'RecycleTree';
