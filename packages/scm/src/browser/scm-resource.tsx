import * as React from 'react';
import { Autowired, Injectable, Optional } from '@ali/common-di';
import { TreeViewActionTypes, SelectableTreeNode, URI } from '@ali/ide-core-browser';
import * as paths from '@ali/ide-core-common/lib/path';
import { IThemeService } from '@ali/ide-theme';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';
import { IContextMenu } from '@ali/ide-core-browser/lib/menu/next';

import { ISCMResource, ISCMResourceGroup } from '../common';

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
  public focused: boolean = false;

  readonly style: React.CSSProperties = {
    fontWeight: 500,
    backgroundColor: 'var(--sideBarSectionHeader-background)',
  };

  readonly depth = 0;
  readonly parent = undefined;

  constructor(
    @Optional() item: ISCMResourceGroup,
    @Optional() scmMenu?: IContextMenu,
  ) {
    this.id = item.id;
    this.name = item.label;
    this.badge = item.elements.length;
    this.item = item;
    this.resourceGroupState = item.toJSON();
    this.actions = scmMenu ? this.getInlineActions(scmMenu) : null;
  }

  private getInlineActions(scmMenu: IContextMenu) {
    return [{
      location: TreeViewActionTypes.TreeNode_Right,
      component: <InlineMenuBar<ISCMResourceGroup> context={[this.item]} menus={scmMenu} separator='inline' />,
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
  public focused: boolean = false;

  readonly actions: any;

  readonly depth = 0;
  readonly parent = undefined;

  constructor(
    @Optional() item: ISCMResource,
    @Optional() scmMenu?: IContextMenu,
  ) {
    this.id = item.resourceGroup.id + item.sourceUri;
    this.name = paths.basename(item.sourceUri.path);
    const filePath = paths.parse(item.sourceUri.path);
    this.description = paths.relative(item.resourceGroup.provider.rootUri!.path, filePath.dir),
    this.badge = item.decorations.letter || '';
    this.tooltip = item.decorations.tooltip || '';
    this.item = item;
    this.resourceState = item.toJSON();

    this.badgeStyle = this.getBadgeStyle();
    this.icon = this.labelService.getIcon(URI.from(this.item.sourceUri));
    this.actions = scmMenu ? this.getInlineActions(scmMenu) : null;
  }

  private getBadgeStyle(): React.CSSProperties | undefined {
    const { color: kolor } = this.item.decorations;
    const color = kolor && this.themeService.getColor({ id: kolor });
    return color ? { color } : undefined;
  }

  private getInlineActions(scmMenu: IContextMenu) {
    return [{
      location: TreeViewActionTypes.TreeNode_Right,
      component: <InlineMenuBar<ISCMResource> context={[this.item]} menus={scmMenu} separator='inline' />,
    }];
  }
}
