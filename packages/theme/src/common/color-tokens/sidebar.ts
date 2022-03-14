import { localize } from '@opensumi/ide-core-common';

import { Color } from '../../common/color';
import { registerColor } from '../color-registry';

import { contrastBorder } from './base';

// < --- Side Bar --- >

export const SIDE_BAR_BACKGROUND = registerColor(
  'sideBar.background',
  {
    dark: '#252526',
    light: '#F3F3F3',
    hc: '#000000',
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
    hc: null,
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
    hc: contrastBorder,
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
    hc: SIDE_BAR_FOREGROUND,
  },
  localize(
    'sideBarTitleForeground',
    'Side bar title foreground color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_DRAG_AND_DROP_BACKGROUND = registerColor(
  'sideBar.dropBackground',
  {
    dark: Color.white.transparent(0.12),
    light: Color.black.transparent(0.1),
    hc: Color.white.transparent(0.3),
  },
  localize(
    'sideBarDragAndDropBackground',
    'Drag and drop feedback color for the side bar sections. The color should have transparency so that the side bar sections can still shine through. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_BACKGROUND = registerColor(
  'sideBarSectionHeader.background',
  {
    dark: Color.fromHex('#808080').transparent(0.2),
    light: Color.fromHex('#808080').transparent(0.2),
    hc: null,
  },
  localize(
    'sideBarSectionHeaderBackground',
    'Side bar section header background color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_FOREGROUND = registerColor(
  'sideBarSectionHeader.foreground',
  {
    dark: SIDE_BAR_FOREGROUND,
    light: SIDE_BAR_FOREGROUND,
    hc: SIDE_BAR_FOREGROUND,
  },
  localize(
    'sideBarSectionHeaderForeground',
    'Side bar section header foreground color. The side bar is the container for views like explorer and search.',
  ),
);

export const SIDE_BAR_SECTION_HEADER_BORDER = registerColor(
  'sideBarSectionHeader.border',
  {
    dark: contrastBorder,
    light: contrastBorder,
    hc: contrastBorder,
  },
  localize(
    'sideBarSectionHeaderBorder',
    'Side bar section header border color. The side bar is the container for views like explorer and search.',
  ),
);
