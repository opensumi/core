import { localize } from '@ali/ide-core-common';

export const scmContainerId = 'scm_container';
export const scmProviderViewId = 'scm_provider';
export const scmResourceViewId = 'scm';

export const scmPanelTitle = localize('scm.title');

export const scmItemLineHeight = 22; // copied from vscode

export * from './scm';
export * from './scm.service';
