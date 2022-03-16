import { IMenubarItem, ISubmenuItem } from '@opensumi/ide-core-browser/lib/menu/next';
import { ISumiMenuExtendInfo } from '@opensumi/ide-core-common';
import { ThemeType } from '@opensumi/ide-theme';

// eslint-disable-next-line import/no-restricted-paths
import type { ITabBarViewContribution } from '../../browser/sumi-browser/types';
// eslint-disable-next-line import/no-restricted-paths
import type { IToolbarButtonContribution, IToolbarSelectContribution } from '../../browser/sumi/types';
import { IExtensionContributions } from '../vscode/extension';

export interface IContributeMenubarItem extends Omit<IMenubarItem, 'label'> {
  title: IMenubarItem['label'];
}

export interface IContributedSubmenu extends Omit<ISubmenuItem, 'submenu' | 'label' | 'order' | 'iconClass'> {
  id: ISubmenuItem['submenu']; // submenu id
  title?: ISubmenuItem['label']; // label 后续对插件输出统一使用 title 字段
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

export interface ISumiExtensionContributions extends IExtensionContributions {
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
    [menuId: string]: Array<ISumiMenuExtendInfo>;
  };
}
