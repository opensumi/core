import { IContextMenu } from '@ali/ide-core-browser/lib/menu/next';
import { ISCMResource, ISCMResourceGroup, ISCMProvider } from './scm';

export interface ISCMRepositoryMenus {
  readonly titleMenu: IContextMenu;
  readonly inputMenu: IContextMenu;
  getResourceGroupMenu(group: ISCMResourceGroup): IContextMenu;
  getResourceMenu(resource: ISCMResource): IContextMenu;
}

export const ISCMMenus = Symbol('ISCMMenus');
export interface ISCMMenus {
  getRepositoryMenus(provider: ISCMProvider): ISCMRepositoryMenus;
}
