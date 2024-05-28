import { Color } from '../color';
import { darken, opaque, registerColor } from '../utils';

import { editorBackground, editorForeground } from './editor';
import { listInactiveSelectionBackground } from './list-tree';

export const overviewRulerCommentingRangeForeground = registerColor(
  'editorGutter.commentRangeForeground',
  {
    dark: opaque(listInactiveSelectionBackground, editorBackground),
    light: darken(opaque(listInactiveSelectionBackground, editorBackground), 0.05),
    hcDark: Color.white,
    hcLight: Color.black,
  },
  'Editor gutter decoration color for commenting ranges. This color should be opaque.',
);
const overviewRulerCommentForeground = registerColor(
  'editorOverviewRuler.commentForeground',
  {
    dark: overviewRulerCommentingRangeForeground,
    light: overviewRulerCommentingRangeForeground,
    hcDark: overviewRulerCommentingRangeForeground,
    hcLight: overviewRulerCommentingRangeForeground,
  },
  'Editor overview ruler decoration color for resolved comments. This color should be opaque.',
);
export const overviewRulerCommentUnresolvedForeground = registerColor(
  'editorOverviewRuler.commentUnresolvedForeground',
  {
    dark: overviewRulerCommentForeground,
    light: overviewRulerCommentForeground,
    hcDark: overviewRulerCommentForeground,
    hcLight: overviewRulerCommentForeground,
  },
  'Editor overview ruler decoration color for unresolved comments. This color should be opaque.',
);

const editorGutterCommentGlyphForeground = registerColor(
  'editorGutter.commentGlyphForeground',
  { dark: editorForeground, light: editorForeground, hcDark: Color.black, hcLight: Color.white },
  'Editor gutter decoration color for commenting glyphs.',
);
registerColor(
  'editorGutter.commentUnresolvedGlyphForeground',
  {
    dark: editorGutterCommentGlyphForeground,
    light: editorGutterCommentGlyphForeground,
    hcDark: editorGutterCommentGlyphForeground,
    hcLight: editorGutterCommentGlyphForeground,
  },
  'Editor gutter decoration color for commenting glyphs for unresolved comment threads.',
);
