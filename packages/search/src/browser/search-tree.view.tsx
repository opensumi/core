import * as React from 'react';
import { URI } from '@ali/ide-core-common';
import { ConfigContext } from '@ali/ide-core-browser';
import { RecycleTree } from '@ali/ide-core-browser/lib/components';
import { IFileTreeItem } from '@ali/ide-file-tree';
import { FileStat } from '@ali/ide-file-service/lib/common/';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { ExplorerService } from '@ali/ide-explorer/lib/browser/explorer.service';
import {
  ContentSearchResult,
  SEARCH_STATE,
} from '../common';
import * as styles from './search.module.less';

const itemLineHeight = 22;

function onSelect(
  files: IFileTreeItem[],
  workbenchEditorService,
  nodes: IFileTreeItem[], setNodes,
) {
  const file: IFileTreeItem = files[0];

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
      range: {
        startLineNumber: result.line - 1,
        startColumn: result.matchStart - 1,
        endLineNumber: result.line - 1,
        endColumn: result.matchStart - 1 + result.matchLength,
      },
    },
  );
}

function getRenderTree(nodes: IFileTreeItem[]) {
  return nodes.filter((node) => {
    if (node && node.parent && !node.parent.expanded) {
      return false;
    }
    return true;
  });
}

function getChildren(resultList: ContentSearchResult[], uri: URI, parent?): IFileTreeItem[] {
  const result: IFileTreeItem[] = [];

  resultList.forEach((searchResult: ContentSearchResult, index: number) => {
    result.push({
      filestat: {} as FileStat,
      id: uri.toString() + index,
      name: searchResult.lineText,
      description: searchResult.lineText,
      order: index,
      depth: 1,
      searchResult,
      parent,
      uri,
    });
  });

  return result;
}

function getNodes( searchResults: Map<string, ContentSearchResult[]> | null): IFileTreeItem[] {
  const result: IFileTreeItem[] = [];
  let order = 0;

  if (!searchResults) {
    return result;
  }

  searchResults.forEach((resultList: ContentSearchResult[], uri: string) => {
    const _uri = new URI(uri);
    const node: IFileTreeItem  = {
      filestat: {} as FileStat,
      expanded: true,
      id: uri,
      uri: _uri,
      name: _uri.displayName,
      order: order++,
      depth: 0,
      parent: undefined,
    };
    node.children = getChildren(resultList, _uri, node);
    result.push(node);
    node.children.forEach((child) => {
      result.push(child);
    });
  });

  return result;
}

function getScrollbarStyle(explorerService: ExplorerService, searchOptionEl: Element) {
  return {
    width: explorerService.layout.width,
    height: explorerService.layout.height - searchOptionEl.getBoundingClientRect().height - 30,
  };
}

function getScrollContentStyle(explorerService: ExplorerService, searchOptionEl: Element) {
  return {
    width: explorerService.layout.width,
    height: explorerService.layout.height - searchOptionEl.getBoundingClientRect().height - 30,
  };
}

export const SearchTree = (
  {
    searchResults,
    searchValue,
    searchOptionEl,
    searchState,
  }: {
    searchOptionEl: React.RefObject<HTMLDivElement>,
    searchResults: Map<string, ContentSearchResult[]> | null,
    searchValue: string,
    searchState: SEARCH_STATE,
  },
) => {
  const configContext = React.useContext(ConfigContext);
  const { injector } = configContext;
  const workbenchEditorService = injector.get(WorkbenchEditorService);
  const explorerService = injector.get(ExplorerService);
  const result = Array.from((searchResults || []));
  const treeEl = React.useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = React.useState(() => {
    return getNodes(searchResults);
  });

  return (
    <div className={styles.tree} ref={treeEl}>
      {searchResults && result.length > 0 ?
        <RecycleTree
          onSelect = { (files) => { onSelect(files, workbenchEditorService, nodes, setNodes); } }
          nodes = { getRenderTree(nodes) }
          scrollbarStyle = { getScrollbarStyle(explorerService, searchOptionEl.current as Element) }
          scrollContentStyle = {getScrollContentStyle(explorerService, searchOptionEl.current as Element) }
          contentNumber = { nodes.length }
          itemLineHeight = { itemLineHeight }
        / > :
        <div className={styles.result_describe}>
          {searchState === SEARCH_STATE.done ? 'No results found.' : ''}
        </div>
      }
    </div>
  );
};
