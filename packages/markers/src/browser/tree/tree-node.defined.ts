import { CompositeTreeNode, ITree, TreeNode } from '@opensumi/ide-components';

import { IMarkerService, IRenderableMarker, IRenderableMarkerModel } from '../../common/types';
import { SeverityIconStyle } from '../markers-seriverty-icon';

export class MarkerRoot extends CompositeTreeNode {
  static is(node: MarkerGroupNode | MarkerRoot): node is MarkerRoot {
    return !!node && !node.parent;
  }

  constructor(tree: IMarkerService) {
    super(tree as ITree, undefined);
  }

  get expanded() {
    return true;
  }
}

export class MarkerGroupNode extends CompositeTreeNode {
  constructor(tree: IMarkerService, public readonly model: IRenderableMarkerModel, parent: MarkerRoot) {
    super(tree as ITree, parent);
    this.isExpanded = true;
  }

  get tooltip() {
    return this.model.resource;
  }

  get badge() {
    return this.model.size();
  }

  get icon() {
    return this.model.icon;
  }

  dispose() {
    super.dispose();
  }
}

export class MarkerNode extends TreeNode {
  constructor(tree: IMarkerService, public marker: IRenderableMarker, parent: MarkerGroupNode | undefined) {
    super(tree as ITree, parent, undefined);
  }

  get iconStyle() {
    return SeverityIconStyle[(this._tree as IMarkerService).getThemeType()][this.marker.severity];
  }

  get tooltip() {
    return this.marker.message;
  }
}
