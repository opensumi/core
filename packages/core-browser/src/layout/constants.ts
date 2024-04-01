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
  #menubarHeight: number;
  #editorTabsHeight: number;
  #bigSurTitleBarHeight: number;
  #titleBarHeight: number;
  #panelTitleBarHeight: number;
  #statusBarHeight: number;
  #accordionHeaderSizeHeight: number;

  constructor(private readonly layoutViewSize?: Partial<ILayoutViewSize>) {
    this.#menubarHeight = this.layoutViewSize?.menubarHeight || DEFAULT_LAYOUT_VIEW_SIZE.menubarHeight;
    this.#editorTabsHeight = this.layoutViewSize?.editorTabsHeight || DEFAULT_LAYOUT_VIEW_SIZE.editorTabsHeight;
    this.#bigSurTitleBarHeight =
      this.layoutViewSize?.bigSurTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.bigSurTitleBarHeight;
    this.#titleBarHeight = this.layoutViewSize?.titleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.titleBarHeight;
    this.#panelTitleBarHeight =
      this.layoutViewSize?.panelTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.panelTitleBarHeight;
    this.#statusBarHeight = this.layoutViewSize?.statusBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.statusBarHeight;
    this.#accordionHeaderSizeHeight =
      this.layoutViewSize?.accordionHeaderSizeHeight || DEFAULT_LAYOUT_VIEW_SIZE.accordionHeaderSizeHeight;
  }

  get menubarHeight(): number {
    return this.#menubarHeight;
  }
  setMenubarHeight(value: number) {
    this.#menubarHeight = value;
  }

  get editorTabsHeight(): number {
    return this.#editorTabsHeight;
  }
  setEditorTabsHeight(value: number) {
    this.#editorTabsHeight = value;
  }

  get bigSurTitleBarHeight(): number {
    return this.#bigSurTitleBarHeight;
  }
  setBigSurTitleBarHeight(value: number) {
    this.#bigSurTitleBarHeight = value;
  }

  get titleBarHeight(): number {
    return this.#titleBarHeight;
  }
  setTitleBarHeight(value: number) {
    this.#titleBarHeight = value;
  }

  get panelTitleBarHeight(): number {
    return this.#panelTitleBarHeight;
  }
  setPanelTitleBarHeight(value: number) {
    this.#panelTitleBarHeight = value;
  }

  get statusBarHeight(): number {
    return this.#statusBarHeight;
  }
  setStatusBarHeight(value: number) {
    this.#statusBarHeight = value;
  }

  get accordionHeaderSizeHeight(): number {
    return this.#accordionHeaderSizeHeight;
  }
  setAccordionHeaderSizeHeight(value: number) {
    this.#accordionHeaderSizeHeight = value;
  }
}
