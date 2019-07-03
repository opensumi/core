import { MAIN_MENU_BAR } from '..';

export namespace COMMON_MENUS {
  export const FILE = [...MAIN_MENU_BAR, '1_file'];
  export const FILE_NEW = [...FILE, '1_new'];
  export const FILE_SAVE = [...FILE, '3_save'];
  export const FILE_SETTINGS = [...FILE, '5_settings'];
  export const FILE_SETTINGS_SUBMENU = [...FILE_SETTINGS, '1_settings_submenu'];
  export const FILE_SETTINGS_SUBMENU_OPEN = [...FILE_SETTINGS_SUBMENU, '1_settings_submenu_open'];
  export const FILE_SETTINGS_SUBMENU_THEME = [...FILE_SETTINGS_SUBMENU, '2_settings_submenu_theme'];
  export const FILE_CLOSE = [...FILE, '6_close'];

  export const EDIT = [...MAIN_MENU_BAR, '2_edit'];
  export const EDIT_UNDO = [...EDIT, '1_undo'];
  export const EDIT_CLIPBOARD = [...EDIT, '2_clipboard'];
  export const EDIT_FIND = [...EDIT, '3_find'];

  export const VIEW = [...MAIN_MENU_BAR, '4_view'];
  export const VIEW_PRIMARY = [...VIEW, '0_primary'];
  export const VIEW_VIEWS = [...VIEW, '1_views'];
  export const VIEW_LAYOUT = [...VIEW, '2_layout'];
  export const VIEW_THEME = [...VIEW, '3_theme'];

  // last menu item
  export const HELP = [...MAIN_MENU_BAR, '9_help'];
}
