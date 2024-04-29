import { DESIGN_MENU_BAR_LEFT, DESIGN_MENU_BAR_RIGHT } from '@opensumi/ide-design';

import { AI_CHAT_CONTAINER_ID, AI_CHAT_LOGO_AVATAR_ID, AI_CHAT_VIEW_ID } from '../../common';

export const AIChatLayoutConfig = {
  [AI_CHAT_VIEW_ID]: {
    modules: [AI_CHAT_CONTAINER_ID],
  },
  [DESIGN_MENU_BAR_RIGHT]: {
    modules: [AI_CHAT_LOGO_AVATAR_ID],
  },
};

/**
 * @deprecated Use {@link DESIGN_MENU_BAR_RIGHT} instead
 */
export const AI_MENU_BAR_RIGHT = DESIGN_MENU_BAR_RIGHT;
/**
 * @deprecated Use {@link DESIGN_MENU_BAR_LEFT} instead
 */
export const AI_MENU_BAR_LEFT = DESIGN_MENU_BAR_LEFT;
