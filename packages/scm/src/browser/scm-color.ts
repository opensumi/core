import { localize } from '@ide-framework/ide-core-common';
import { registerColor, Color, RGBA } from '@ide-framework/ide-theme';

// 这里都是 scm 相关颜色变量注册
/* istanbul ignore file */
export const editorGutterModifiedBackground = registerColor('editorGutter.modifiedBackground', {
  dark: new Color(new RGBA(12, 125, 157)),
  light: new Color(new RGBA(102, 175, 224)),
  hc: new Color(new RGBA(0, 73, 122)),
}, localize('editorGutterModifiedBackground', 'Editor gutter background color for lines that are modified.'));

export const editorGutterAddedBackground = registerColor('editorGutter.addedBackground', {
  dark: new Color(new RGBA(88, 124, 12)),
  light: new Color(new RGBA(129, 184, 139)),
  hc: new Color(new RGBA(27, 82, 37)),
}, localize('editorGutterAddedBackground', 'Editor gutter background color for lines that are added.'));

export const editorGutterDeletedBackground = registerColor('editorGutter.deletedBackground', {
  dark: new Color(new RGBA(148, 21, 27)),
  light: new Color(new RGBA(202, 75, 81)),
  hc: new Color(new RGBA(141, 14, 20)),
}, localize('editorGutterDeletedBackground', 'Editor gutter background color for lines that are deleted.'));

const overviewRulerDefault = new Color(new RGBA(0, 122, 204, 0.6));

export const overviewRulerModifiedForeground = registerColor('editorOverviewRuler.modifiedForeground', {
  dark: overviewRulerDefault,
  light: overviewRulerDefault,
  hc: overviewRulerDefault,
}, localize('overviewRulerModifiedForeground', 'Overview ruler marker color for modified content.'));

export const overviewRulerAddedForeground = registerColor('editorOverviewRuler.addedForeground', {
  dark: overviewRulerDefault,
  light: overviewRulerDefault,
  hc: overviewRulerDefault,
}, localize('overviewRulerAddedForeground', 'Overview ruler marker color for added content.'));

export const overviewRulerDeletedForeground = registerColor('editorOverviewRuler.deletedForeground', {
  dark: overviewRulerDefault,
  light: overviewRulerDefault,
  hc: overviewRulerDefault,
}, localize('overviewRulerDeletedForeground', 'Overview ruler marker color for deleted content.'));
