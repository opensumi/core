export class CommonCls {
  add(a: number, b: number) {
    return a + b;
  }
}

export const scmContainerId = 'scm_container';
export const scmProviderViewId = 'scm_provider';
export const scmResourceViewId = 'scm';

export const scmPanelTitle = 'SOURCE CONTROL';

export const scmItemLineHeight = 22; // copied from vscode

export * from './scm';
export * from './scm.service';
