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
    onTwistieClick,
    itemLineHeight = 22,
    commandActuator,
    outline,
  }: SourceTreeProps,
) => {
  const noop = () => { };

  const contentStyle = {
    height: nodes.length * itemLineHeight,
    userSelect: 'text',
  };

  const renderNodes = React.useMemo(() => {
    let order = 0;
    return nodes.map((node) => {
      const result =  {
        ...node,
        order,
      };
      if (node.title) {
        order += 2;
      } else {
        order ++;
      }
      return result;
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
      onContextMenu={onContextMenu || noop}
      onSelect={onSelect || noop}
      onChange={onChange || noop}
      onTwistieClick={onTwistieClick}
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
      onTwistieClick={onTwistieClick}
      draggable={draggable}
      foldable={foldable}
      searchable={searchable}
      editable={editable}
      outline={outline}
    />
  </React.Fragment>;
};

SourceTree.displayName = 'SourceTree';
