import { localize } from '@opensumi/ide-core-common';

import { registerColor } from '../../utils';

// https://github.com/microsoft/vscode/blob/master/extensions/git/package.json#L1696
// 将 vscode git 插件的颜色变量复制一份，应对不存在 git 插件的场景，比如 web scm/文件树/变更树等场景
export const addedResourceDecorationForeground = registerColor(
  'kt.decoration.addedResourceForeground',
  {
    light: '#587c0c',
    dark: '#81b88b',
    hcDark: '#1b5225',
    hcLight: null,
  },
  localize('addedResourceDecorationForeground', 'Color for added resources.'),
);

export const modifiedResourceForeground = registerColor(
  'kt.decoration.modifiedResourceForeground',
  {
    light: '#895503',
    dark: '#E2C08D',
    hcDark: '#E2C08D',
    hcLight: null,
  },
  localize('modifiedResourceForeground', 'Color for modified resources.'),
);

export const deletedResourceForeground = registerColor(
  'kt.decoration.deletedResourceForeground',
  {
    light: '#ad0707',
    dark: '#c74e39',
    hcDark: '#c74e39',
    hcLight: null,
  },
  localize('deletedResourceForeground', 'Color for deleted resources.'),
);

export const untrackedResourceForeground = registerColor(
  'kt.decoration.untrackedResourceForeground',
  {
    light: '#007100',
    dark: '#73C991',
    hcDark: '#73C991',
    hcLight: null,
  },
  localize('untrackedResourceForeground', 'Color for untracked resources.'),
);

export const ignoredResourceForeground = registerColor(
  'kt.decoration.ignoredResourceForeground',
  {
    light: '#8E8E90',
    dark: '#8C8C8C',
    hcDark: '#A7A8A9',
    hcLight: null,
  },
  localize('ignoredResourceForeground', 'Color for ignored resources.'),
);

export const conflictingResourceForeground = registerColor(
  'kt.decoration.conflictingResourceForeground',
  {
    light: '#6c6cc4',
    dark: '#6c6cc4',
    hcDark: '#6c6cc4',
    hcLight: null,
  },
  localize('conflictingResourceForeground', 'Color for resources with conflicts.'),
);
