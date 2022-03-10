import fuzzy from 'fuzzy';
import React from 'react';

import { Deprecated } from '@opensumi/ide-components/lib/utils';

import { PerfectScrollbar } from '../scrollbar';
import { TreeProps, TreeContainer, TreeNode, ExpandableTreeNode, TEMP_FILE_NAME } from '../tree';

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
    [key: string]: string | number | boolean | undefined;
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
    [key: string]: string | number | boolean | undefined;
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

/**
 * @deprecated will be removed in v2.17.0 version
 */
export const DeprecatedRecycleTree = ({
  nodes,
  leftPadding,
  defaultLeftPadding,
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
  onReveal,
  filter,
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
  alwaysShowActions,
}: RecycleTreeProps) => {
  const noop = () => {};
  const contentNumber = Math.ceil(containerHeight / itemLineHeight);
  const [scrollRef, setScrollRef] = React.useState<HTMLDivElement>();
  const [renderedStart, setRenderedStart] = React.useState(0);
  const [renderNodes, setRenderNodes] = React.useState<TreeNode[]>([]);
  const renderedEnd: number = renderedStart + contentNumber + prerenderNumber;
  // 预加载因子
  const preFactor = 3 / 4;
  const upPrerenderNumber = Math.floor(prerenderNumber * preFactor);
  const fuzzyOptions = {
    pre: '<match>',
    post: '</match>',
    extract: (node: TreeNode) => {
      if (typeof node.name === 'string') {
        return node.name;
      }
      return '';
    },
  };

  const isEqualOrParent = (node1: TreeNode, node2: TreeNode) => {
    if (node1.id === node2.id) {
      return true;
    }
    let parent = node2.parent;
    while (parent) {
      if (parent.id === node1.id) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  };

  const isEqual = (node1: TreeNode, node2: TreeNode) => {
    if (node1.id === node2.id) {
      return true;
    }
    return false;
  };

  React.useEffect(() => {
    if (typeof scrollTop === 'number' && scrollRef) {
      scrollRef.scrollTop = scrollTop;
    }
    setRenderedStart(scrollTop ? Math.floor(scrollTop / itemLineHeight) : 0);
  }, [scrollTop]);

  React.useEffect(() => {
    let renderedFileItems;
    if (filter) {
      const fuzzyLists = fuzzy.filter(filter, nodes, fuzzyOptions);
      const tempNode = nodes.find((node: TreeNode) => node.name === TEMP_FILE_NAME);
      renderedFileItems = nodes
        .map((node: TreeNode) => {
          for (const item of fuzzyLists) {
            if (isEqual(node, (item as any).original)) {
              // 匹配，存在高亮
              return {
                ...node,
                name: () => (
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    dangerouslySetInnerHTML={{ __html: item.string || '' }}
                  ></div>
                ),
              };
            } else if (isEqualOrParent(node, (item as any).original) || (tempNode && isEqualOrParent(node, tempNode))) {
              // 子节点存在匹配，不高亮但需展示
              return node;
            } else if (node.name === TEMP_FILE_NAME) {
              // 如果为新建节点的节点，直接返回展示
              return node;
            }
          }
        })
        .filter((node: TreeNode) => !!node);
    } else {
      renderedFileItems = nodes;
    }
    renderedFileItems = renderedFileItems!.filter(
      (item: TreeNode, index: number) => renderedStart <= index && index <= renderedEnd,
    );
    renderedFileItems = renderedFileItems.map((item: TreeNode, index: number) => {
      let highLightRanges = item.highLightRanges;
      if (!highLightRanges && searchable && search) {
        highLightRanges = {
          name: [],
          description: [],
        };
        let start;
        let end;
        if (typeof item.name === 'string') {
          let step = 0;
          start = item.name.indexOf(search);
          while (start >= 0) {
            end = start + search.length;
            highLightRanges.name!.push({
              start: start + step,
              end: end + step,
            });
            step += end;
            start = item.name.indexOf(search.slice(end));
          }
        }
        if (typeof item.description === 'string') {
          let step = 0;
          start = item.description.indexOf(search);
          while (start >= 0) {
            end = start + search.length;
            highLightRanges.description!.push({
              start: start + step,
              end: end + step,
            });
            step += end;
            start = item.description.indexOf(search.slice(end));
          }
        }
      }
      return {
        ...item,
        order: renderedStart + index,
        highLightRanges,
        replace,
      };
    });
    setRenderNodes(renderedFileItems);
  }, [nodes, renderedStart, scrollContainerStyle]);

  React.useEffect(() => {
    if (scrollRef) {
      scrollRef.scrollTop = 0;
    }
    setRenderedStart(0);
  }, [filter]);

  const scrollUpHandler = (element: Element) => {
    const positionIndex = Math.floor(element.scrollTop / itemLineHeight);
    if (positionIndex > upPrerenderNumber) {
      const start = positionIndex - upPrerenderNumber;
      // 当开始位置超过节点长度时，重置其实位置
      setRenderedStart(start > nodes.length ? 0 : start);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollUpThrottledHandler = (element: Element) => {
    requestAnimationFrame(() => {
      scrollUpHandler(element);
    });
  };

  const scrollDownHandler = (element: Element) => {
    const positionIndex = Math.floor(element.scrollTop / itemLineHeight);
    if (positionIndex > prerenderNumber - upPrerenderNumber) {
      const start = positionIndex - (prerenderNumber - upPrerenderNumber);
      // 当开始位置超过节点长度时，重置其实位置
      setRenderedStart(start > nodes.length ? 0 : start);
    } else {
      setRenderedStart(0);
    }
  };

  const scrollDownThrottledHandler = (element: Element) => {
    requestAnimationFrame(() => {
      scrollDownHandler(element);
    });
  };

  const contentStyle = scrollContentStyle || {
    width: '100%',
    height: nodes.length * itemLineHeight <= containerHeight ? containerHeight : nodes.length * itemLineHeight,
    userSelect: 'none',
  };

  const scrollerBarOptions = {
    minScrollbarLength: 20,
  };

  const isComplex = !!nodes!.find(<T extends TreeNode>(node: T, index: number) => ExpandableTreeNode.is(node));

  return (
    <React.Fragment>
      <PerfectScrollbar
        style={scrollContainerStyle}
        onScrollUp={scrollUpThrottledHandler}
        onScrollDown={scrollDownThrottledHandler}
        containerRef={(ref) => {
          setScrollRef(ref);
        }}
        options={scrollerBarOptions}
      >
        <TreeContainer
          style={contentStyle}
          multiSelectable={multiSelectable}
          itemLineHeight={itemLineHeight}
          nodes={renderNodes}
          actions={actions}
          commandActuator={commandActuator}
          leftPadding={leftPadding}
          defaultLeftPadding={defaultLeftPadding}
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
          onReveal={onReveal || noop}
          onTwistieClick={onTwistieClick}
          draggable={draggable}
          foldable={foldable}
          replace={replace}
          editable={editable}
          fileDecorationProvider={fileDecorationProvider}
          themeProvider={themeProvider}
          notifyFileDecorationsChange={notifyFileDecorationsChange}
          notifyThemeChange={notifyThemeChange}
          validate={validate}
          isComplex={isComplex}
          alwaysShowActions={alwaysShowActions}
        />
      </PerfectScrollbar>
    </React.Fragment>
  );
};

DeprecatedRecycleTree.displayName = 'DeprecatedRecycleTree';

export const RecycleTree = Deprecated(
  DeprecatedRecycleTree,
  '[Deprecated warning]: The `RecycleTree` component in `@opensumi/ide-core-browser` will be removed in v2.17.0 version. Please use the new `RecycleTree` in `@opensumi/ide-component` instead',
);
