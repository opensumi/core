import { localize } from '@opensumi/ide-core-common';
import { Color, RGBA, editorErrorForeground, registerColor, transparent } from '@opensumi/ide-theme';

// 这里都是 scm 相关颜色变量注册
/* istanbul ignore file */
export const editorGutterModifiedBackground = registerColor(
  'editorGutter.modifiedBackground',
  {
    dark: new Color(new RGBA(27, 129, 168)),
    light: new Color(new RGBA(32, 144, 211)),
    hcDark: new Color(new RGBA(27, 128, 168)),
    hcLight: new Color(new RGBA(32, 144, 211)),
  },
  localize('editorGutterModifiedBackground', 'Editor gutter background color for lines that are modified.'),
);

export const editorGutterAddedBackground = registerColor(
  'editorGutter.addedBackground',
  {
    dark: new Color(new RGBA(72, 126, 2)),
    light: new Color(new RGBA(72, 152, 93)),
    hcDark: new Color(new RGBA(72, 126, 2)),
    hcLight: new Color(new RGBA(72, 152, 93)),
  },
  localize('editorGutterAddedBackground', 'Editor gutter background color for lines that are added.'),
);

export const editorGutterDeletedBackground = registerColor(
  'editorGutter.deletedBackground',
  {
    dark: editorErrorForeground,
    light: editorErrorForeground,
    hcDark: editorErrorForeground,
    hcLight: editorErrorForeground,
  },
  localize('editorGutterDeletedBackground', 'Editor gutter background color for lines that are deleted.'),
);

export const minimapGutterModifiedBackground = registerColor(
  'minimapGutter.modifiedBackground',
  {
    dark: editorGutterModifiedBackground,
    light: editorGutterModifiedBackground,
    hcDark: editorGutterModifiedBackground,
    hcLight: editorGutterModifiedBackground,
  },
  localize('minimapGutterModifiedBackground', 'Minimap gutter background color for lines that are modified.'),
);

export const minimapGutterAddedBackground = registerColor(
  'minimapGutter.addedBackground',
  {
    dark: editorGutterAddedBackground,
    light: editorGutterAddedBackground,
    hcDark: editorGutterAddedBackground,
    hcLight: editorGutterAddedBackground,
  },
  localize('minimapGutterAddedBackground', 'Minimap gutter background color for lines that are added.'),
);

export const minimapGutterDeletedBackground = registerColor(
  'minimapGutter.deletedBackground',
  {
    dark: editorGutterDeletedBackground,
    light: editorGutterDeletedBackground,
    hcDark: editorGutterDeletedBackground,
    hcLight: editorGutterDeletedBackground,
  },
  localize('minimapGutterDeletedBackground', 'Minimap gutter background color for lines that are deleted.'),
);

export const overviewRulerModifiedForeground = registerColor(
  'editorOverviewRuler.modifiedForeground',
  {
    dark: transparent(editorGutterModifiedBackground, 0.6),
    light: transparent(editorGutterModifiedBackground, 0.6),
    hcDark: transparent(editorGutterModifiedBackground, 0.6),
    hcLight: transparent(editorGutterModifiedBackground, 0.6),
  },
  localize('overviewRulerModifiedForeground', 'Overview ruler marker color for modified content.'),
);

export const overviewRulerAddedForeground = registerColor(
  'editorOverviewRuler.addedForeground',
  {
    dark: transparent(editorGutterAddedBackground, 0.6),
    light: transparent(editorGutterAddedBackground, 0.6),
    hcDark: transparent(editorGutterAddedBackground, 0.6),
    hcLight: transparent(editorGutterAddedBackground, 0.6),
  },
  localize('overviewRulerAddedForeground', 'Overview ruler marker color for added content.'),
);

export const overviewRulerDeletedForeground = registerColor(
  'editorOverviewRuler.deletedForeground',
  {
    dark: transparent(editorGutterDeletedBackground, 0.6),
    light: transparent(editorGutterDeletedBackground, 0.6),
    hcDark: transparent(editorGutterDeletedBackground, 0.6),
    hcLight: transparent(editorGutterDeletedBackground, 0.6),
  },
  localize('overviewRulerDeletedForeground', 'Overview ruler marker color for deleted content.'),
);
