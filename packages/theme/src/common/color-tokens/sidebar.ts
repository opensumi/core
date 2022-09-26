import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../utils';

import { contrastBorder } from './base';
import { EDITOR_DRAG_AND_DROP_BACKGROUND } from './editor';

// < --- Side Bar --- >

export const SIDE_BAR_BACKGROUND = registerColor(
  'sideBar.background',
  {
    dark: '#252526',
    light: '#F3F3F3',
    hcDark: '#000000',
    hcLight: '#FFFFFF',
  },
  localize(
    'sideBarBackground',
    'Side bar background color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_FOREGROUND = registerColor(
  'sideBar.foreground',
  {
    dark: null,
    light: null,
    hcDark: null,
    hcLight: null,
  },
  localize(
    'sideBarForeground',
    'Side bar foreground color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_BORDER = registerColor(
  'sideBar.border',
  {
    dark: null,
    light: null,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'sideBarBorder',
    'Side bar border color on the side separating to the editor. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_TITLE_FOREGROUND = registerColor(
  'sideBarTitle.foreground',
  {
    dark: SIDE_BAR_FOREGROUND,
    light: SIDE_BAR_FOREGROUND,
    hcDark: SIDE_BAR_FOREGROUND,
    hcLight: SIDE_BAR_FOREGROUND,
  },
  localize(
    'sideBarTitleForeground',
    'Side bar title foreground color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_DRAG_AND_DROP_BACKGROUND = registerColor(
  'sideBar.dropBackground',
  {
    dark: EDITOR_DRAG_AND_DROP_BACKGROUND,
    light: EDITOR_DRAG_AND_DROP_BACKGROUND,
    hcDark: EDITOR_DRAG_AND_DROP_BACKGROUND,
    hcLight: EDITOR_DRAG_AND_DROP_BACKGROUND,
  },
  localize(
    'sideBarDragAndDropBackground',
    'Drag and drop feedback color for the side bar sections. The color should have transparency so that the side bar sections can still shine through. The side bar is the container for views like explorer and search. Side bar sections are views nested within the side bar.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_BACKGROUND = registerColor(
  'sideBarSectionHeader.background',
  {
    dark: Color.fromHex('#808080').transparent(0.2),
    light: Color.fromHex('#808080').transparent(0.2),
    hcDark: null,
    hcLight: null,
  },
  localize(
    'sideBarSectionHeaderBackground',
    'Side bar section header background color. The side bar is the container for views like explorer and search. Side bar sections are views nested within the side bar.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_FOREGROUND = registerColor(
  'sideBarSectionHeader.foreground',
  {
    dark: SIDE_BAR_FOREGROUND,
    light: SIDE_BAR_FOREGROUND,
    hcDark: SIDE_BAR_FOREGROUND,
    hcLight: SIDE_BAR_FOREGROUND,
  },
  localize(
    'sideBarSectionHeaderForeground',
    'Side bar section header foreground color. The side bar is the container for views like explorer and search. Side bar sections are views nested within the side bar.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_BORDER = registerColor(
  'sideBarSectionHeader.border',
  {
    dark: contrastBorder,
    light: contrastBorder,
    hcDark: contrastBorder,
    hcLight: contrastBorder,
  },
  localize(
    'sideBarSectionHeaderBorder',
    'Side bar section header border color. The side bar is the container for views like explorer and search. Side bar sections are views nested within the side bar.',
  ),
);
