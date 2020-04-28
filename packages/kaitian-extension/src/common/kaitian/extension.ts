import { IMenubarItem, ISubmenuItem } from '@ali/ide-core-browser/lib/menu/next';
import { ThemeType } from '@ali/ide-theme';

import { IExtensionContributions } from '../vscode/extension';

export interface IContributeMenubarItem extends Omit<IMenubarItem, 'label'> {
  title: IMenubarItem['label'];
}

export interface IContributedSubmenu extends Omit<ISubmenuItem, 'submenu' | 'label' | 'order' | 'iconClass'> {
  id: ISubmenuItem['submenu']; // submenu id
  title?: ISubmenuItem['label']; // label 后续对插件输出统一使用 title 字段 @柳千
  when?: string;
  icon?: { [index in ThemeType]: string } | string;
}

export interface IKaitianExtensionContributions extends IExtensionContributions {
  menubars?: IContributeMenubarItem[];
}
