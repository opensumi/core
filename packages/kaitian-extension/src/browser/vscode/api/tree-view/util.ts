import { Command, getIcon } from '@ali/ide-core-browser';

const TREE_VIEW_COMMAND_PREFIX = 'TREE_VIEW';

export const getTreeViewCollapseAllCommandId = (treeViewId: string) => {
  return `${TREE_VIEW_COMMAND_PREFIX}_COLLAPSE_ALL_${treeViewId}`;
};

export const getTreeViewCollapseAllCommand = (treeViewId: string): Command => {
  return {
    id: `${TREE_VIEW_COMMAND_PREFIX}_COLLAPSE_ALL_${treeViewId}`,
    iconClass: getIcon('collapse-all'),
  };
};
