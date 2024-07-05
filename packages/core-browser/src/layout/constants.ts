import merge from 'lodash/merge';

import { Injectable } from '@opensumi/di';
import { IDesignLayoutConfig, isMacintosh } from '@opensumi/ide-core-common';

import { electronEnv } from '../utils/electron';

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

@Injectable()
export class LayoutViewSizeConfig implements ILayoutViewSize {
  #menubarHeight: number;
  #editorTabsHeight: number;
  #bigSurTitleBarHeight: number;
  #titleBarHeight: number;
  #panelTitleBarHeight: number;
  #statusBarHeight: number;
  #accordionHeaderSizeHeight: number;

  private inited = false;
  init(layoutViewSize: Partial<ILayoutViewSize> = {}) {
    if (this.inited) {
      return;
    }
    this.inited = true;

    this.#menubarHeight = layoutViewSize.menubarHeight || DEFAULT_LAYOUT_VIEW_SIZE.menubarHeight;
    this.#editorTabsHeight = layoutViewSize.editorTabsHeight || DEFAULT_LAYOUT_VIEW_SIZE.editorTabsHeight;
    this.#bigSurTitleBarHeight = layoutViewSize.bigSurTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.bigSurTitleBarHeight;
    this.#titleBarHeight = layoutViewSize.titleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.titleBarHeight;
    this.#panelTitleBarHeight = layoutViewSize.panelTitleBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.panelTitleBarHeight;
    this.#statusBarHeight = layoutViewSize.statusBarHeight || DEFAULT_LAYOUT_VIEW_SIZE.statusBarHeight;
    this.#accordionHeaderSizeHeight =
      layoutViewSize.accordionHeaderSizeHeight || DEFAULT_LAYOUT_VIEW_SIZE.accordionHeaderSizeHeight;
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

  protected supportNewMacHeaderBar = electronEnv.osRelease ? parseFloat(electronEnv.osRelease) >= 20 : false;

  calcElectronHeaderHeight(): number {
    if (isMacintosh) {
      // Big Sur increases title bar height
      return this.supportNewMacHeaderBar ? this.bigSurTitleBarHeight : this.titleBarHeight;
    }
    return this.menubarHeight;
  }

  calcOnlyTitleBarHeight(): number {
    if (isMacintosh && this.supportNewMacHeaderBar) {
      return this.bigSurTitleBarHeight;
    }
    return this.titleBarHeight;
  }
}

@Injectable()
export class DesignLayoutConfig implements IDesignLayoutConfig {
  private internalLayout: Required<IDesignLayoutConfig> = {
    useMergeRightWithLeftPanel: false,
    useMenubarView: false,
    menubarLogo: '',
    quickOpenContainerStyle: {},
  };

  setLayout(...value: (Partial<IDesignLayoutConfig> | undefined)[]): void {
    this.internalLayout = merge(this.internalLayout, ...value.filter(Boolean));
  }

  get useMergeRightWithLeftPanel(): boolean {
    return this.internalLayout.useMergeRightWithLeftPanel;
  }

  get menubarLogo(): string {
    return this.internalLayout.menubarLogo;
  }

  get quickOpenContainerStyle(): React.CSSProperties {
    return this.internalLayout.quickOpenContainerStyle;
  }
}
