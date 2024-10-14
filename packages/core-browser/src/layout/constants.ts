import merge from 'lodash/merge';

import { Injectable } from '@opensumi/di';
import { IDesignLayoutConfig, isDefined, isMacintosh } from '@opensumi/ide-core-common';

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

export enum ConfigPriority {
  ModuleDefined,
  UserDefined,
}

/**
 * 支持多档优先级配置
 */
class ConfigAtom<T> {
  /**
   * index 越高，优先级越高
   */
  protected _value: (T | undefined)[] = [];
  constructor(public defaultValue: T) {}

  setValue(value: T | undefined, priority: number) {
    this._value[priority] = value;
  }

  getValue(): T {
    let value = this.defaultValue;

    for (let i = this._value.length - 1; i >= 0; i--) {
      if (isDefined(this._value[i])) {
        value = this._value[i]!;
        break;
      }
    }

    return value;
  }
}

@Injectable()
export class LayoutViewSizeConfig implements ILayoutViewSize {
  #menubarHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.menubarHeight);
  #editorTabsHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.editorTabsHeight);
  #bigSurTitleBarHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.bigSurTitleBarHeight);
  #titleBarHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.titleBarHeight);
  #panelTitleBarHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.panelTitleBarHeight);
  #statusBarHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.statusBarHeight);
  #accordionHeaderSizeHeight = new ConfigAtom(DEFAULT_LAYOUT_VIEW_SIZE.accordionHeaderSizeHeight);

  private inited = false;
  init(layoutViewSize: Partial<ILayoutViewSize> = {}) {
    if (this.inited) {
      return;
    }
    this.inited = true;

    this.#menubarHeight.setValue(layoutViewSize.menubarHeight, ConfigPriority.UserDefined);
    this.#editorTabsHeight.setValue(layoutViewSize.editorTabsHeight, ConfigPriority.UserDefined);
    this.#bigSurTitleBarHeight.setValue(layoutViewSize.bigSurTitleBarHeight, ConfigPriority.UserDefined);
    this.#titleBarHeight.setValue(layoutViewSize.titleBarHeight, ConfigPriority.UserDefined);
    this.#panelTitleBarHeight.setValue(layoutViewSize.panelTitleBarHeight, ConfigPriority.UserDefined);
    this.#statusBarHeight.setValue(layoutViewSize.statusBarHeight, ConfigPriority.UserDefined);
    this.#accordionHeaderSizeHeight.setValue(layoutViewSize.accordionHeaderSizeHeight, ConfigPriority.UserDefined);
  }

  get menubarHeight(): number {
    return this.#menubarHeight.getValue();
  }
  setMenubarHeight(value: number, priority?: number) {
    this.#menubarHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get editorTabsHeight(): number {
    return this.#editorTabsHeight.getValue();
  }
  setEditorTabsHeight(value: number, priority?: number) {
    this.#editorTabsHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get bigSurTitleBarHeight(): number {
    return this.#bigSurTitleBarHeight.getValue();
  }
  setBigSurTitleBarHeight(value: number, priority?: number) {
    this.#bigSurTitleBarHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get titleBarHeight(): number {
    return this.#titleBarHeight.getValue();
  }
  setTitleBarHeight(value: number, priority?: number) {
    this.#titleBarHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get panelTitleBarHeight(): number {
    return this.#panelTitleBarHeight.getValue();
  }
  setPanelTitleBarHeight(value: number, priority?: number) {
    this.#panelTitleBarHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get statusBarHeight(): number {
    return this.#statusBarHeight.getValue();
  }
  setStatusBarHeight(value: number, priority?: number) {
    this.#statusBarHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
  }

  get accordionHeaderSizeHeight(): number {
    return this.#accordionHeaderSizeHeight.getValue();
  }
  setAccordionHeaderSizeHeight(value: number, priority?: number) {
    this.#accordionHeaderSizeHeight.setValue(value, priority ?? ConfigPriority.ModuleDefined);
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
    supportExternalChatPanel: false,
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

  get supportExternalChatPanel(): boolean {
    return this.internalLayout.supportExternalChatPanel;
  }
}
