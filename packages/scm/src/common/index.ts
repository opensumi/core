export const scmContainerId = 'scm';
export const scmProviderViewId = 'scm_provider';
export const scmResourceViewId = 'scm_view';

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
