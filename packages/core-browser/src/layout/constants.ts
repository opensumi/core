export interface ILayoutViewSize {
  MENUBAR_HEIGHT: number;
  EDITOR_TABS_HEIGHT: number;
  BIG_SUR_TITLEBAR_HEIGHT: number;
  TITLEBAR_HEIGHT: number;
  PANEL_TITLEBAR_HEIGHT: number;
  STATUSBAR_HEIGHT: number;
}

export const DEFAULT_LAYOUT_VIEW_SIZE: ILayoutViewSize = {
  MENUBAR_HEIGHT: 35,
  EDITOR_TABS_HEIGHT: 35,
  BIG_SUR_TITLEBAR_HEIGHT: 28,
  TITLEBAR_HEIGHT: 22,
  PANEL_TITLEBAR_HEIGHT: 35,
  STATUSBAR_HEIGHT: 24,
};

export class LayoutViewSizeConfig implements ILayoutViewSize {
  constructor(private readonly layoutViewSize?: Partial<ILayoutViewSize>) {}

  get MENUBAR_HEIGHT(): number {
    return this.layoutViewSize?.MENUBAR_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.MENUBAR_HEIGHT;
  }
  get EDITOR_TABS_HEIGHT(): number {
    return this.layoutViewSize?.EDITOR_TABS_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.EDITOR_TABS_HEIGHT;
  }
  get BIG_SUR_TITLEBAR_HEIGHT(): number {
    return this.layoutViewSize?.BIG_SUR_TITLEBAR_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.BIG_SUR_TITLEBAR_HEIGHT;
  }
  get TITLEBAR_HEIGHT(): number {
    return this.layoutViewSize?.TITLEBAR_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.TITLEBAR_HEIGHT;
  }
  get PANEL_TITLEBAR_HEIGHT(): number {
    return this.layoutViewSize?.PANEL_TITLEBAR_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.PANEL_TITLEBAR_HEIGHT;
  }
  get STATUSBAR_HEIGHT(): number {
    return this.layoutViewSize?.STATUSBAR_HEIGHT || DEFAULT_LAYOUT_VIEW_SIZE.STATUSBAR_HEIGHT;
  }
}
