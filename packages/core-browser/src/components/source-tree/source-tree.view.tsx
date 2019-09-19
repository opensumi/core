import * as React from 'react';
import { TreeProps, TreeContainer, TreeNode } from '../tree';

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
    scrollContentStyle,
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
  }: SourceTreeProps,
) => {
  const noop = () => { };

  const contentStyle = scrollContentStyle || {
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
    />
  </React.Fragment>;
};

SourceTree.displayName = 'SourceTree';
