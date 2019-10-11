import * as React from 'react';
import { URI } from '@ali/ide-core-common';
import { ConfigContext, localize } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeNodeHighlightRange } from '@ali/ide-core-browser/lib/components';
import { ViewState } from '@ali/ide-activity-panel';
import { SearchBrowserService } from './search.service';
import * as styles from './search.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { SearchTreeService } from './search-tree.service';

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  children?: ISearchTreeItem[];
  badge?: number;
  highLightRange?: TreeNodeHighlightRange;
  [key: string]: any;
}

export interface ISearchLayoutProp {
  width: number;
  height: number;
  [key: string]: any;
}

export interface ISearchTreeProp {
  searchPanelLayout: {
    width: number;
    height: number;
  };
  viewState: ViewState;

}

const itemLineHeight = 22;

function getRenderTree(nodes: ISearchTreeItem[]) {
  return nodes.filter((node) => {
    if (node && node.parent) {
      if (node.parent.expanded === false) {
        return false;
      }
    }
    return true;
  });
}

function getScrollContainerStyle(viewState: ViewState, searchPanelLayout: any): ISearchLayoutProp {
  return {
    width: viewState.width || 0,
    height: viewState.height - searchPanelLayout.height - 55 || 0,
  } as ISearchLayoutProp;
}

// TODO 状态管理交给 search-file-tree.service

export const SearchTree = React.forwardRef((
  {
    searchPanelLayout,
    viewState,
  }: ISearchTreeProp,
  ref,
) => {
  const configContext = React.useContext(ConfigContext);
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState<ISearchLayoutProp>({
    width: 0,
    height: 0,
  });
  const [nodes, setNodes] = React.useState<ISearchTreeItem[]>([]);
  const { injector } = configContext;
  const searchBrowserService: SearchBrowserService = injector.get(SearchBrowserService);
  const searchTreeService: SearchTreeService = injector.get(SearchTreeService);

  const { replaceValue, resultTotal } = searchBrowserService;
  const { onContextMenu, commandActuator, onSelect, updateNodes } = searchTreeService;

  // 请勿在tsx中操作 setNodes，应该使用 searchTreeService.setNodes
  searchTreeService._setNodes = setNodes;
  searchTreeService._nodes = nodes;

  React.useEffect(() => {
    setScrollContainerStyle(getScrollContainerStyle(viewState, searchPanelLayout));
  }, [searchPanelLayout, viewState.height, viewState.width]);

  React.useEffect(() => {
    updateNodes();
  }, [resultTotal.resultNum]);

  return (
    <div className={styles.tree}>
      {nodes && nodes.length > 0 ?
        <RecycleTree
          onContextMenu={ onContextMenu }
          replace={ replaceValue || '' }
          onSelect = { (files) => { onSelect(files); } }
          nodes = { getRenderTree(nodes) }
          scrollContainerStyle = { scrollContainerStyle }
          containerHeight = { scrollContainerStyle.height }
          itemLineHeight = { itemLineHeight }
          commandActuator= { (cmdId, id) => {
            commandActuator(
              cmdId,
              id,
            );
            return {};
          } }
          actions= {[{
            icon: getIcon('replace'),
            title: localize('search.replace.title'),
            command: 'replaceResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: getIcon('eye-close'),
            title: localize('search.result.hide'),
            command: 'closeResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: getIcon('replace'),
            title: localize('search.replace.title'),
            command: 'replaceResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          },
          {
            icon: getIcon('eye-close'),
            title: localize('search.result.hide'),
            command: 'closeResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          }]}
        / > :    ''
      }
    </div>
  );
});
