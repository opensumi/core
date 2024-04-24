import { SlotLocation } from '@opensumi/ide-core-browser';

import { DESIGN_MENUBAR_CONTAINER_VIEW_ID } from '../../common';

export const DesignMenubarLayoutConfig = {
  [SlotLocation.top]: {
    modules: [DESIGN_MENUBAR_CONTAINER_VIEW_ID],
  },
};
