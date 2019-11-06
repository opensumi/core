import * as React from 'react';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { TreeViewActionTypes, SelectableTreeNode, URI } from '@ali/ide-core-common';
import * as paths from '@ali/ide-core-common/lib/path';
import { IThemeService } from '@ali/ide-theme';
import { LabelService } from '@ali/ide-core-browser/lib/services';

import { ISCMResource, ISCMResourceGroup } from '../common';
import { SCMMenus } from './scm-menu';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';

interface ISCMResourceTreeNode extends SelectableTreeNode {
  id: string;
  name: string;
  description?: string;
  badge: number | string; // changes 数量 | decoration
  style?: React.CSSProperties;
  selected: boolean;
  item: ISCMResourceGroup | ISCMResource;
  // 固定属性
  depth: 0;
  parent: undefined;
}

export class SCMResourceGroupTreeNode implements ISCMResourceTreeNode {
  readonly id: string;
  readonly name: string;
  readonly badge: number;
  readonly item: ISCMResourceGroup;
  readonly resourceGroupState: any;

  readonly actions: any;

  // 视图可直接传入
  public selected: boolean = false;

  readonly style: React.CSSProperties = { fontWeight: 500 };
  readonly depth = 0;
  readonly parent = undefined;

  constructor(
    @Optional() item: ISCMResourceGroup,
    @Optional() private readonly scmMenuService: SCMMenus,
  ) {
    this.id = item.id;
    this.name = item.label;
    this.badge = item.elements.length;
    this.item = item;
    this.resourceGroupState = item.toJSON();
    this.actions = this.getInlineActions();
  }

  private getInlineActions() {
    const menus = this.scmMenuService.getResourceGroupInlineActions(this.item);
    return [{
      location: TreeViewActionTypes.TreeNode_Right,
      component: <InlineActionBar<ISCMResourceGroup> context={[this.item]} menus={menus} seperator='inline' />,
    }];
  }
}

@Injectable()
export class SCMResourceTreeNode implements ISCMResourceTreeNode {
  @Autowired(IThemeService)
  private readonly themeService: IThemeService;

  @Autowired(LabelService)
  private readonly labelService: LabelService;

  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly badge: string;
  readonly item: ISCMResource;
  readonly resourceState: any;
  readonly tooltip: string;

  readonly badgeStyle: React.CSSProperties | undefined;
  readonly icon: string;

  // 视图可直接传入
  public selected: boolean = false;

  readonly actions: any;

  readonly depth = 0;
  readonly parent = undefined;

  constructor(
    @Optional() item: ISCMResource,
    @Optional() private readonly scmMenuService: SCMMenus,
  ) {
    this.id = item.resourceGroup.id + item.sourceUri;
    this.name = paths.basename(item.sourceUri.toString());
    const filePath = paths.parse(item.sourceUri.path);
    this.description = paths.relative(item.resourceGroup.provider.rootUri!.path, filePath.dir),
    this.badge = item.decorations.letter || '';
    this.tooltip = item.decorations.tooltip || '';
    this.item = item;
    this.resourceState = item.toJSON();

    this.badgeStyle = this.getBadgeStyle();
    this.icon = this.labelService.getIcon(URI.from(this.item.sourceUri));
    this.actions = this.getInlineActions();
  }

  private getBadgeStyle(): React.CSSProperties | undefined {
    const { color: kolor } = this.item.decorations;
    const color = kolor && this.themeService.getColor({ id: kolor });
    return color ? { color } : undefined;
  }

  private getInlineActions() {
    const menus = this.scmMenuService.getResourceInlineActions(this.item.resourceGroup);
    return [{
      location: TreeViewActionTypes.TreeNode_Right,
      component: <InlineActionBar<ISCMResource> context={[this.item]} menus={menus} seperator='inline' />,
    }];
  }
}
