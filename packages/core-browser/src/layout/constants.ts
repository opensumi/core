export interface ILayoutViewSize {
  menubarHeight: number;
  editorTabsHeight: number;
  bigSurTitleBarHeight: number;
  titleBarHeight: number;
  panelTitleBarHeight: number;
  statusBarHeight: number;
  accordionHeaderSizeHeight: number;
}

export const DEFAULT_LAYOUT_VIEW_SIZE: ILayoutViewSize = {
  menubarHeight: 35,
  editorTabsHeight: 35,
  bigSurTitleBarHeight: 28,
  titleBarHeight: 22,
  panelTitleBarHeight: 35,
  statusBarHeight: 24,
  accordionHeaderSizeHeight: 24,
};

export class LayoutViewSizeConfig implements ILayoutViewSize {
  constructor(private readonly layoutViewSize?: Partial<ILayoutViewSize>) {}

  get menubarHeight(): number {
    return this.layoutViewSize?.menubarHeight || DEFAULT_LAYOUT_VIEW_SIZE.menubarHeight;
  }
  get editorTabsHeight(): number {
    return this.layoutViewSize?.editorTabsHeight || DEFAULT_LAYOUT_VIEW_SIZE.editorTabsHeight;
  }
  get bigSurTitleBarHeight(): number {
    return this.layoutViewSize?.bigSurTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.bigSurTitleBarHeight;
  }
  get titleBarHeight(): number {
    return this.layoutViewSize?.titleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.titleBarHeight;
  }
  get panelTitleBarHeight(): number {
    return this.layoutViewSize?.panelTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.panelTitleBarHeight;
  }
  get statusBarHeight(): number {
    return this.layoutViewSize?.statusBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.statusBarHeight;
  }
  get accordionHeaderSizeHeight(): number {
    return this.layoutViewSize?.accordionHeaderSizeHeight || DEFAULT_LAYOUT_VIEW_SIZE.accordionHeaderSizeHeight;
  }
}
