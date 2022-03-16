import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../color-registry';

// https://github.com/microsoft/vscode/blob/master/extensions/git/package.json#L1696
// 将 vscode git 插件的颜色变量复制一份，应对不存在 git 插件的场景，比如 web scm/文件树/变更树等场景
export const addedResourceDecorationForeground = registerColor(
  'kt.decoration.addedResourceForeground',
  {
    light: '#587c0c',
    dark: '#81b88b',
    hc: '#1b5225',
  },
  localize('addedResourceDecorationForeground', 'Color for added resources.'),
);

export const modifiedResourceForeground = registerColor(
  'kt.decoration.modifiedResourceForeground',
  {
    light: '#895503',
    dark: '#E2C08D',
    hc: '#E2C08D',
  },
  localize('modifiedResourceForeground', 'Color for modified resources.'),
);

export const deletedResourceForeground = registerColor(
  'kt.decoration.deletedResourceForeground',
  {
    light: '#ad0707',
    dark: '#c74e39',
    hc: '#c74e39',
  },
  localize('deletedResourceForeground', 'Color for deleted resources.'),
);

export const untrackedResourceForeground = registerColor(
  'kt.decoration.untrackedResourceForeground',
  {
    light: '#007100',
    dark: '#73C991',
    hc: '#73C991',
  },
  localize('untrackedResourceForeground', 'Color for untracked resources.'),
);

export const ignoredResourceForeground = registerColor(
  'kt.decoration.ignoredResourceForeground',
  {
    light: '#8E8E90',
    dark: '#8C8C8C',
    hc: '#A7A8A9',
  },
  localize('ignoredResourceForeground', 'Color for ignored resources.'),
);

export const conflictingResourceForeground = registerColor(
  'kt.decoration.conflictingResourceForeground',
  {
    light: '#6c6cc4',
    dark: '#6c6cc4',
    hc: '#6c6cc4',
  },
  localize('conflictingResourceForeground', 'Color for resources with conflicts.'),
);
