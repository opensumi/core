import { CompositeTreeNode, ITree, TreeNode } from '@opensumi/ide-components';
import { URI } from '@opensumi/ide-core-common';

import { ContentSearchResult, ISearchTreeService } from '../../common/content-search';

export class SearchRoot extends CompositeTreeNode {
  static is(node: SearchFileNode | SearchRoot): node is SearchRoot {
    return !!node && !node.parent;
  }

  constructor(tree: ISearchTreeService) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
  }
}

export class SearchFileNode extends CompositeTreeNode {
  constructor(
    tree: ISearchTreeService,
    public contentResults: ContentSearchResult[],
    public description: string = '',
    public tooltip: string,
    public icon: string,
    public resource: URI,
    parent: SearchRoot,
  ) {
    super(tree as ITree, parent);
    this.isExpanded = true;
  }

  get displayName() {
    return this.resource.displayName;
  }

  get badge() {
    return this.branchSize;
  }

  get highlight() {
    return {};
  }
}

export interface ISearchHighlightRange {
  start: number;
  end: number;
}

export class SearchContentNode extends TreeNode {
  constructor(
    tree: ISearchTreeService,
    public contentResult: ContentSearchResult,
    public description: string = '',
    public highlight: ISearchHighlightRange,
    public resource: URI,
    parent: SearchFileNode | undefined,
  ) {
    super(tree as ITree, parent);
  }

  get displayName() {
    return '';
  }

  get tooltip() {
    if (this.description && this.highlight) {
      const { start, end } = this.highlight;
      return `${this.description.slice(0, start)}${
        (this._tree as ISearchTreeService).replaceValue || this.description.slice(start, end)
      }${this.description.slice(end)}`.slice(0, 999);
    }
    return '';
  }
}
