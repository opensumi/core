import { Color } from '../color';
import { ITheme } from '../theme.service';
import { registerColor, transparent } from '../utils';

import { contrastBorder, disabledForeground } from './base';
import { listFocusOutline } from './list-tree';
import { peekViewTitleBackground } from './pick-view';

export enum CommentThreadState {
  Unresolved = 0,
  Resolved = 1,
}

const resolvedCommentViewIcon = registerColor(
  'commentsView.resolvedIcon',
  { dark: disabledForeground, light: disabledForeground, hcDark: contrastBorder, hcLight: contrastBorder },
  'Icon color for resolved comments.',
);
const unresolvedCommentViewIcon = registerColor(
  'commentsView.unresolvedIcon',
  { dark: listFocusOutline, light: listFocusOutline, hcDark: contrastBorder, hcLight: contrastBorder },
  'Icon color for unresolved comments.',
);

registerColor(
  'editorCommentsWidget.replyInputBackground',
  {
    dark: peekViewTitleBackground,
    light: peekViewTitleBackground,
    hcDark: peekViewTitleBackground,
    hcLight: peekViewTitleBackground,
  },
  'Background color for comment reply input box.',
);
const resolvedCommentBorder = registerColor(
  'editorCommentsWidget.resolvedBorder',
  { dark: resolvedCommentViewIcon, light: resolvedCommentViewIcon, hcDark: contrastBorder, hcLight: contrastBorder },
  'Color of borders and arrow for resolved comments.',
);
const unresolvedCommentBorder = registerColor(
  'editorCommentsWidget.unresolvedBorder',
  {
    dark: unresolvedCommentViewIcon,
    light: unresolvedCommentViewIcon,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  'Color of borders and arrow for unresolved comments.',
);
export const commentThreadRangeBackground = registerColor(
  'editorCommentsWidget.rangeBackground',
  {
    dark: transparent(unresolvedCommentBorder, 0.1),
    light: transparent(unresolvedCommentBorder, 0.1),
    hcDark: transparent(unresolvedCommentBorder, 0.1),
    hcLight: transparent(unresolvedCommentBorder, 0.1),
  },
  'Color of background for comment ranges.',
);
export const commentThreadRangeActiveBackground = registerColor(
  'editorCommentsWidget.rangeActiveBackground',
  {
    dark: transparent(unresolvedCommentBorder, 0.1),
    light: transparent(unresolvedCommentBorder, 0.1),
    hcDark: transparent(unresolvedCommentBorder, 0.1),
    hcLight: transparent(unresolvedCommentBorder, 0.1),
  },
  'Color of background for currently selected or hovered comment range.',
);

const commentThreadStateBorderColors = new Map([
  [CommentThreadState.Unresolved, unresolvedCommentBorder],
  [CommentThreadState.Resolved, resolvedCommentBorder],
]);

const commentThreadStateIconColors = new Map([
  [CommentThreadState.Unresolved, unresolvedCommentViewIcon],
  [CommentThreadState.Resolved, resolvedCommentViewIcon],
]);

export const commentThreadStateColorVar = '--comment-thread-state-color';
export const commentViewThreadStateColorVar = '--comment-view-thread-state-color';
export const commentThreadStateBackgroundColorVar = '--comment-thread-state-background-color';

function getCommentThreadStateColor(
  state: CommentThreadState | undefined,
  theme: ITheme,
  map: Map<CommentThreadState, string>,
): Color | undefined {
  const colorId = state !== undefined ? map.get(state) : undefined;
  return colorId !== undefined ? theme.getColor(colorId) : undefined;
}

export function getCommentThreadStateBorderColor(
  state: CommentThreadState | undefined,
  theme: ITheme,
): Color | undefined {
  return getCommentThreadStateColor(state, theme, commentThreadStateBorderColors);
}

export function getCommentThreadStateIconColor(
  state: CommentThreadState | undefined,
  theme: ITheme,
): Color | undefined {
  return getCommentThreadStateColor(state, theme, commentThreadStateIconColors);
}
