import { IMenubarItem, ISubmenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { ThemeType } from '@ali/ide-theme';

import { IExtensionContributions } from '../vscode/extension';
import { ITabBarViewContribution } from '../../browser/kaitian-browser/types';

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
  viewsProxies?: string[];
  workerMain?: string;
  nodeMain?: string;
  browserMain?: string;
}
