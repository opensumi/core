import * as React from 'react';
import { URI } from '@ali/ide-core-common';
import { ConfigContext } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeNodeHighlightRange } from '@ali/ide-core-browser/lib/components';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ViewState } from '@ali/ide-activity-panel';
import { IWorkspaceService } from '@ali/ide-workspace';
import { replaceAll } from './replace';
import {
  ContentSearchResult,
  ResultTotal,
} from '../common';
import { SearchBrowserService } from './search.service';
import * as styles from './search.module.less';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';

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

function onSelect(
  files: ISearchTreeItem[],
  workbenchEditorService,
  nodes: ISearchTreeItem[],
  setNodes,
) {
  const file: ISearchTreeItem = files[0];

  if (!file) {
    return;
  }

  if (!file.parent) {
    // Click file name
    const newNodes = nodes.map((node) => {
      if (node.id === file!.id) {
        node.expanded = !node.expanded;
      }
      return node;
    });
    return setNodes(newNodes);
  }

  // Click file result line
  const result: ContentSearchResult = file.searchResult;
  return workbenchEditorService.open(
    new URI(result.fileUri),
    {
      disableNavigate: true,
      range: {
        startLineNumber: result.line,
        startColumn: result.matchStart,
        endLineNumber: result.line,
        endColumn: result.matchStart + result.matchLength,
      },
    },
  );
}

function commandActuator(
  commandId: string,
  id: string,
  searchResults: Map<string, ContentSearchResult[]>,
  items: ISearchTreeItem[],
  documentModelManager: IEditorDocumentModelService,
  replaceText: string,
  resultTotal: ResultTotal,
  searchBrowserService: SearchBrowserService,
) {
  const methods = {
    closeResult() {
      const parentId = id.replace(/\?index=\d$/, '');
      const matchIndex = id.match(/\d$/);
      if (!matchIndex || !parentId) {
        return;
      }
      const index = matchIndex[0];
      const oldData = searchResults.get(parentId);
      if (!oldData) {
        return;
      }
      if (oldData.length === 1) {
        return methods.closeResults(parentId);
      }
      oldData.splice(Number(index), 1);
      resultTotal.resultNum = resultTotal.resultNum - 1;
    },
    replaceResult() {
      let select: ISearchTreeItem | null = null;
      items.some((item) => {
        if (id === item.id) {
          select = item;
          return true;
        }
      });
      if (!select) {
        return;
      }
      const resultMap: Map<string, ContentSearchResult[]> = new Map();
      resultMap.set(select!.parent!.uri!.toString(), [select!.searchResult]);
      replaceAll(
        documentModelManager,
        resultMap,
        replaceText,
      ).then(() => {
        // 结果树更新由 search.service.watchDocModelContentChange 负责
      });
    },
    closeResults(insertId?: string) {
      const parentId = insertId || id.replace(/\?index=\d$/, '');
      if (!parentId) {
        return;
      }
      const oldData = searchResults.get(parentId);
      resultTotal.fileNum = resultTotal.fileNum - 1;
      resultTotal.resultNum = resultTotal.resultNum - oldData!.length;
      searchResults.delete(parentId);
    },
    replaceResults() {
      let select: ISearchTreeItem | null = null;
      items.some((item) => {
        if (id === item.id) {
          select = item;
          return true;
        }
      });
      if (!select) {
        return;
      }
      const resultMap: Map<string, ContentSearchResult[]> = new Map();
      const contentSearchResult: ContentSearchResult[] = select!.children!.map((child) => {
        return child.searchResult;
      });
      resultMap.set(select!.fileUri, contentSearchResult);
      replaceAll(
        documentModelManager,
        resultMap,
        replaceText,
      ).then(() => {
         // 结果树更新由 search.service.watchDocModelContentChange 负责
      });
    },
  };

  if (!methods[commandId]) {
    return;
  }
  return methods[commandId]();
}

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

function getChildrenNodes(resultList: ContentSearchResult[], uri: URI, replaceValue: string, parent?): ISearchTreeItem[] {
  const result: ISearchTreeItem[] = [];
  resultList.forEach((searchResult: ContentSearchResult, index: number) => {
    result.push({
      id: `${uri.toString()}?index=${index}`,
      name: searchResult.lineText,
      highLightRange: {
        start: searchResult.matchStart - 1,
        end: searchResult.matchStart + searchResult.matchLength - 1,
      },
      order: index,
      depth: 1,
      searchResult,
      parent,
      uri,
    });
  });

  return result;
}

async function getParentNodes(
  searchResults: Map<string, ContentSearchResult[]> | null,
  replaceValue: string,
  workspaceService: IWorkspaceService,
): Promise<ISearchTreeItem[]> {
  const result: ISearchTreeItem[] = [];
  let order = 0;

  if (!searchResults) {
    return result;
  }

  for (const searchResultArray of searchResults) {
    const uri = searchResultArray[0];
    const resultList = searchResultArray[1];
    const _uri = new URI(uri);
    const description = await workspaceService.asRelativePath(uri) || uri;
    const node: ISearchTreeItem  = {
      description,
      expanded: true,
      id: uri,
      uri: _uri,
      name: _uri.displayName,
      order: order++,
      depth: 0,
      parent: undefined,
    };
    node.children = getChildrenNodes(resultList, _uri, replaceValue, node);
    node.badge = node.children.length;
    if (node.children.length > 10) {
      // 结果太多大于10 则默认折叠
      node.expanded = false;
    }
    result.push(node);
    node.children.forEach((child) => {
      result.push(child);
    });
  }

  return result;
}

function getScrollContainerStyle(viewState: ViewState, searchPanelLayout: any): ISearchLayoutProp {
  return {
    width: viewState.width || 0,
    height: viewState.height - searchPanelLayout.height - 30 || 0,
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
  const { injector } = configContext;
  const workbenchEditorService: WorkbenchEditorService = injector.get(WorkbenchEditorService);
  const documentModelManager = injector.get(IEditorDocumentModelService);
  const workspaceService = injector.get(IWorkspaceService);
  const searchBrowserService: SearchBrowserService = injector.get(SearchBrowserService);
  const [nodes, setNodes] = React.useState<ISearchTreeItem[]>([]);

  const { searchResults, replaceValue, resultTotal } = searchBrowserService;

  React.useEffect(() => {
    setScrollContainerStyle(getScrollContainerStyle(viewState, searchPanelLayout));
  }, [searchPanelLayout, viewState.height, viewState.width]);

  React.useEffect(() => {
    getParentNodes(searchResults, replaceValue || '', workspaceService)
      .then((data) => {
        setNodes(data);
      });
  }, [resultTotal.resultNum]);

  React.useImperativeHandle(ref, () => ({
    foldTree() {
      const newNodes = nodes.map((node) => {
        node.expanded = false;
        return node;
      });
      setNodes(newNodes);
    },
  }));
  return (
    <div className={styles.tree}>
      {searchResults && searchResults.size > 0 ?
        <RecycleTree
          replace={ replaceValue || '' }
          onSelect = { (files) => { onSelect(files, workbenchEditorService, nodes, setNodes); } }
          nodes = { getRenderTree(nodes) }
          scrollContainerStyle = { scrollContainerStyle }
          containerHeight = { scrollContainerStyle.height }
          itemLineHeight = { itemLineHeight }
          commandActuator= { (cmdId, id) => {
            commandActuator(
              cmdId,
              id,
              searchResults,
              nodes,
              documentModelManager,
              replaceValue || '',
              resultTotal,
              searchBrowserService,
            );
            return {};
          } }
          actions= {[{
            icon: 'volans_icon close',
            title: 'closeFile',
            command: 'closeResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon swap',
            title: 'replaceFile',
            command: 'replaceResult',
            location: TreeViewActionTypes.TreeNode_Right,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon close',
            title: 'closeFolder',
            command: 'closeResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          }, {
            icon: 'volans_icon swap',
            title: 'replaceFolder',
            command: 'replaceResults',
            location: TreeViewActionTypes.TreeContainer,
            paramsKey: 'id',
          }]}
        / > :    ''
      }
    </div>
  );
});
