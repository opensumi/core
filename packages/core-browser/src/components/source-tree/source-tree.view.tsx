import * as React from 'react';
import { TreeProps, TreeContainer, TreeNode } from '../tree';
import { PerfectScrollbar } from '../scrollbar';

export interface SourceTreeProps extends TreeProps {
  /**
   * 缩进大小
   *
   * @type {number}
   * @memberof SourceTreeProps
   */
  leftPadding?: number;
}

export const SourceTree = (
  {
    nodes,
    leftPadding,
    multiSelectable = false,
    scrollContainerStyle,
    onContextMenu,
    onChange,
    draggable = false,
    foldable = true,
    editable,
    searchable = false,
    onSelect,
    onTwistieClickHandler,
    itemLineHeight = 22,
    commandActuator,
    outline,
  }: SourceTreeProps,
) => {
  const noop = () => { };

  const contentStyle = {
    height: nodes.length * itemLineHeight,
  };

  const renderNodes = React.useMemo(() => {
    return nodes.map((node, index) => {
      return {
        ...node,
        order: index,
      };
    });
  }, [nodes]);

  if (scrollContainerStyle) {
    return <PerfectScrollbar
      style={ scrollContainerStyle }
    >
      <TreeContainer
      nodes={renderNodes}
      style={contentStyle}
      multiSelectable={multiSelectable}
      itemLineHeight={itemLineHeight}
      commandActuator={commandActuator}
      leftPadding={leftPadding}
      onContextMenu={onContextMenu}
      onSelect={onSelect || noop}
      onChange={onChange || noop}
      onTwistieClickHandler={onTwistieClickHandler}
      draggable={draggable}
      foldable={foldable}
      searchable={searchable}
      editable={editable}
      outline={outline}
    />
    </PerfectScrollbar>;
  }
  return <React.Fragment>
    <TreeContainer
      nodes={renderNodes}
      style={contentStyle}
      multiSelectable={multiSelectable}
      itemLineHeight={itemLineHeight}
      commandActuator={commandActuator}
      leftPadding={leftPadding}
      onContextMenu={onContextMenu}
      onSelect={onSelect || noop}
      onChange={onChange || noop}
      onTwistieClickHandler={onTwistieClickHandler}
      draggable={draggable}
      foldable={foldable}
      searchable={searchable}
      editable={editable}
      outline={outline}
    />
  </React.Fragment>;
};

SourceTree.displayName = 'SourceTree';
