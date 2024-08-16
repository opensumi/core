export const KERNEL_PANEL_ID = 'kernel-panel';

export enum LibroPanelCollapseItemType {
  PAGE = 'Page',
  KERNEL = 'Kernel',
}

export interface LibroPanelCollapseItem {
  id: string;
  name: string;
  shutdown?: () => Promise<void>;
  restart?: () => Promise<void>;
}

export interface LibroPanelCollapseKernelItem extends LibroPanelCollapseItem {
  notebooks: { sessionId: string; name: string; path: string }[];
}

export interface Props {
  type: LibroPanelCollapseItemType;
  items: LibroPanelCollapseItem[] | undefined;
  refresh: () => void;
  shutdownAll?: () => Promise<void>;
}
