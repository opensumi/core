import * as React from 'react';
import { action } from 'mobx';
import { URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { IEditorDocumentModelService } from '@ali/ide-editor/lib/browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { replaceAll } from './replace';
import { ContentSearchClientService } from './search.service';
import {
  SEARCH_CONTEXT_MENU,
  ContentSearchResult,
  ISearchTreeItem,
} from '../common';

@Injectable()
export class SearchTreeService {
  _setNodes: any = () => {};
  _nodes: ISearchTreeItem[] = [];
  isContextmenuOnFile: boolean = false;

  @Autowired(ContextMenuRenderer)
  contextMenuRenderer: ContextMenuRenderer;

  @Autowired(IEditorDocumentModelService)
  documentModelManager: IEditorDocumentModelService;

  @Autowired(ContentSearchClientService)
  searchBrowserService: ContentSearchClientService;

  @Autowired(IWorkspaceService)
  workspaceService: IWorkspaceService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  set nodes(data: ISearchTreeItem[]) {
    this._setNodes(data);
    this._nodes = data;
  }

  get nodes() {
    return this._nodes;
  }

  @action.bound
  updateNodes() {
    this.getParentNodes().then((data) => {
      this.nodes = data;
    });
  }

  @action.bound
  onContextMenu(files: ISearchTreeItem[], event: React.MouseEvent<HTMLElement>) {
    const { x, y } = event.nativeEvent;
    const file: ISearchTreeItem = files[0];
    if (!file) {
      return;
    }
    const data: any = { x, y, id : file.id};

    data.file = file;

    if (!file.parent) {
      data.path = file.uri!.withoutScheme().toString();
    }

    if (file.parent) {
      this.isContextmenuOnFile = false;
    } else {
      this.isContextmenuOnFile = true;
    }

    this.contextMenuRenderer.render([SEARCH_CONTEXT_MENU], data);
  }

  @action.bound
  onSelect(
    files: ISearchTreeItem[],
  ) {
    const file: ISearchTreeItem = files[0];

    if (!file) {
      return;
    }

    if (!file.parent) {
      // Click file name
      const newNodes = this._nodes.map((node) => {
        if (node.id === file!.id) {
          node.expanded = !node.expanded;
        }
        return node;
      });
      this.nodes = newNodes;
      return;
    }

    // Click file result line
    const result: ContentSearchResult = file.searchResult!;
    return this.workbenchEditorService.open(
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

  @action.bound
  foldTree() {
    const newNodes = this._nodes.map((node) => {
      node.expanded = false;
      return node;
    });
    this.nodes = newNodes;
  }

  @action.bound
  commandActuator(
    commandId: string,
    id: string,
  ) {
    const documentModelManager = this.documentModelManager;
    const { resultTotal, searchResults, replaceValue } = this.searchBrowserService;
    const items = this._nodes;

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
        resultMap.set(select!.parent!.uri!.toString(), [select!.searchResult!]);
        replaceAll(
          documentModelManager,
          resultMap,
          replaceValue,
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
          return child.searchResult!;
        });
        resultMap.set(select!.fileUri, contentSearchResult);
        replaceAll(
          documentModelManager,
          resultMap,
          replaceValue,
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

  private getChildrenNodes(resultList: ContentSearchResult[], uri: URI, parent?): ISearchTreeItem[] {
    const result: ISearchTreeItem[] = [];
    resultList.forEach((searchResult: ContentSearchResult, index: number) => {
      result.push({
        id: `${uri.toString()}?index=${index}`,
        name: '',
        description: searchResult.lineText,
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

  private async getParentNodes(): Promise< ISearchTreeItem[] > {
    const searchResults = this.searchBrowserService.searchResults;
    const workspaceService = this.workspaceService;
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
      node.children = this.getChildrenNodes(resultList, _uri, node);
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

}
