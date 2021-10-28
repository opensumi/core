import { IMenubarItem, ISubmenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { ThemeType } from '@ali/ide-theme';
import { IKaitianMenuExtendInfo } from '@ali/ide-core-common';

import { IExtensionContributions } from '../vscode/extension';
import { ITabBarViewContribution } from '../../browser/kaitian-browser/types';
import { IToolbarButtonContribution, IToolbarSelectContribution } from '../../browser/kaitian/types';

export interface IContributeMenubarItem extends Omit<IMenubarItem, 'label'> {
  title: IMenubarItem['label'];
}

export interface IContributedSubmenu extends Omit<ISubmenuItem, 'submenu' | 'label' | 'order' | 'iconClass'> {
  id: ISubmenuItem['submenu']; // submenu id
  title?: ISubmenuItem['label']; // label 后续对插件输出统一使用 title 字段 @柳千
  when?: string;
  icon?: { [index in ThemeType]: string } | string;
}

export interface IBrowserView {
  type: 'add';
  view: Array<{
    id: string;
    icon: string;
    [prop: string]: any;
  }>;
}

export interface IKaitianExtensionContributions extends IExtensionContributions {
  menubars?: IContributeMenubarItem[];
  browserViews?: {
    [location: string]: {
      type: string;
      view: ITabBarViewContribution[];
    };
  };
  toolbar?: {
    actions?: Array<IToolbarButtonContribution | IToolbarSelectContribution>;
  };
  viewsProxies?: string[];
  workerMain?: string;
  nodeMain?: string;
  browserMain?: string;
  // 针对 vscode contributes 中的 menus 的一些扩展
  menuExtend?: {
    [menuId: string]: Array<IKaitianMenuExtendInfo>;
  };
}
