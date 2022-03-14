import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import { ConfigContext, localize } from '@opensumi/ide-core-browser';
import { ViewState } from '@opensumi/ide-core-browser';
import { getIcon, getExternalIcon } from '@opensumi/ide-core-browser';
import { DeprecatedRecycleTree, TreeNode, TreeViewActionTypes } from '@opensumi/ide-core-browser/lib/components';


import { ResultTotal } from '../common';

import { SearchTreeService } from './search-tree.service';
import styles from './search.module.less';
import { ContentSearchClientService } from './search.service';

export interface ISearchTreeItem extends TreeNode<ISearchTreeItem> {
  children?: ISearchTreeItem[];
  badge?: number;
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
    width: viewState.width || '100%',
    height: viewState.height - searchPanelLayout.height - 50 || 0,
  } as ISearchLayoutProp;
}

const ResultTotalContent = observer<{
  total: ResultTotal;
  searchTreeService: SearchTreeService;
  searchBrowserService: ContentSearchClientService;
}>(({ total, searchTreeService, searchBrowserService }) => {
  if (total.resultNum > 0) {
    return (
      <p className={styles.result_describe}>
        {localize('search.files.result.kt', '{0} result in {1} files')
          .replace('{0}', String(total.resultNum))
          .replace('{1}', String(total.fileNum))}
        <span
          title={localize(
            searchBrowserService.isExpandAllResult
              ? 'search.CollapseDeepestExpandedLevelAction.label'
              : 'search.ExpandDeepestExpandedLevelAction.label',
          )}
          onClick={searchTreeService.foldTree}
          className={cls(
            getIcon(searchBrowserService.isExpandAllResult ? 'collapse-all' : 'expand-all'),
            styles.result_fold,
            { [styles.result_fold_enabled]: total.fileNum > 0 },
            { [styles.result_fold_disabled]: searchBrowserService.isSearchDoing },
          )}
        />
        <span
          title={localize('search.RefreshAction.label')}
          onClick={() => searchBrowserService.refresh()}
          className={cls(getIcon('refresh'), styles.result_fresh)}
        />
      </p>
    );
  }
  return null;
});

export const SearchTree = ({ searchPanelLayout, viewState }: ISearchTreeProp, ref) => {
  const configContext = React.useContext(ConfigContext);
  const [scrollContainerStyle, setScrollContainerStyle] = React.useState<ISearchLayoutProp>({
    width: 0,
    height: 0,
  });
  const [nodes, setNodes] = React.useState<ISearchTreeItem[]>([]);
  const { injector } = configContext;
  const searchBrowserService: ContentSearchClientService = injector.get(ContentSearchClientService);
  const searchTreeService: SearchTreeService = injector.get(SearchTreeService);

  const { replaceValue, resultTotal } = searchBrowserService;
  const { onContextMenu, commandActuator, onSelect, updateNodes, onBlur } = searchTreeService;

  // 请勿在tsx中操作 setNodes，应该使用 searchTreeService.setNodes
  searchTreeService._setNodes = setNodes;
  searchTreeService._nodes = nodes;

  React.useEffect(() => {
    setScrollContainerStyle(getScrollContainerStyle(viewState, searchPanelLayout));
  }, [searchPanelLayout.height, viewState.height, viewState.width, searchPanelLayout.width]);

  React.useEffect(() => {
    updateNodes();
  }, [resultTotal.resultNum]);

  return (
    <div className={styles.tree} onBlur={onBlur}>
      <ResultTotalContent
        total={resultTotal}
        searchTreeService={searchTreeService}
        searchBrowserService={searchBrowserService}
      />
      {nodes && nodes.length > 0 ? (
        <DeprecatedRecycleTree
          leftPadding={0}
          onContextMenu={onContextMenu}
          replace={replaceValue || ''}
          onSelect={(files) => {
            onSelect(files);
          }}
          nodes={getRenderTree(nodes)}
          scrollContainerStyle={scrollContainerStyle}
          containerHeight={scrollContainerStyle.height}
          itemLineHeight={itemLineHeight}
          commandActuator={(cmdId, id) => {
            commandActuator(cmdId, id);
            return {};
          }}
          actions={[
            {
              icon: getExternalIcon('replace'),
              title: localize('search.replace.title'),
              command: 'replaceResult',
              location: TreeViewActionTypes.TreeNode_Right,
              paramsKey: 'id',
            },
            {
              icon: getIcon('eye-close'),
              title: localize('search.result.hide'),
              command: 'closeResult',
              location: TreeViewActionTypes.TreeNode_Right,
              paramsKey: 'id',
            },
            {
              icon: getExternalIcon('replace-all'),
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
            },
          ]}
        />
      ) : (
        ''
      )}
    </div>
  );
};
