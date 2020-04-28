import { IMenubarItem } from '@ali/ide-core-browser/lib/menu/next';

import { IExtensionContributions } from '../vscode/extension';

// tslint:disable no-empty-interface
export interface IContributeMenubarItem extends IMenubarItem {}

export interface IKaitianExtensionContributions extends IExtensionContributions {
  menubars?: IContributeMenubarItem[];
}
