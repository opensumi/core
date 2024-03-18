import { SCM_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';

export const scmContainerId = SCM_CONTAINER_ID;
export const scmProviderViewId = 'scm_provider';
export const scmResourceViewId = 'scm_view';

export const SCM_WELCOME_ID = 'scm-welcome';

export const scmItemLineHeight = 22; // copied from vscode

export const TOGGLE_DIFF_SIDE_BY_SIDE = {
  id: 'toggle.diff.renderSideBySide',
};

export const SET_SCM_TREE_VIEW_MODE = {
  id: 'workbench.scm.action.setTreeViewMode',
};

export const SET_SCM_LIST_VIEW_MODE = {
  id: 'workbench.scm.action.setListViewMode',
};

export enum SCMViewModelMode {
  List = 'list',
  Tree = 'tree',
}

export enum ViewModelSortKey {
  Path = 'path',
  Name = 'name',
  Status = 'status',
}

export * from './scm';
export * from './scm.service';
export * from './scm-menus';
export * from './dirty-diff';
export * from './scm-history';
