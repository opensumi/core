import { observable, computed, action } from 'mobx';

import { Injectable } from '@opensumi/di';
import { QuickOpenItem, HideReason, QuickOpenActionProvider } from '@opensumi/ide-core-browser';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';

import {
  IAutoFocus,
  IQuickOpenCallbacks,
  IQuickOpenModel,
  IQuickOpenWidget,
  QuickOpenInputOptions,
} from './quick-open.type';

@Injectable({ multiple: true })
export class QuickOpenWidget implements IQuickOpenWidget {
  public MAX_HEIGHT = 440;

  @observable
  public inputValue = '';

  @observable
  private _isShow = false;

  @observable
  public validateType?: VALIDATE_TYPE;

  @observable.shallow
  private _items: QuickOpenItem[];

  @computed
  public get isShow() {
    return this._isShow;
  }

  @observable.ref
  private _actionProvider?: QuickOpenActionProvider;

  @observable.ref
  private _autoFocus?: IAutoFocus;

  @observable
  private _isPassword?: boolean;

  @computed
  get isPassword() {
    return this._isPassword;
  }

  @computed
  get selectAll() {
    return this.items.every((item) => item.checked);
  }

  @observable
  private _valueSelection?: [number, number];

  @computed
  get valueSelection() {
    return this._valueSelection;
  }

  @observable
  private _canSelectMany?: boolean;

  @computed
  get canSelectMany() {
    return this._canSelectMany;
  }

  @observable
  public selectIndex = 0;

  @computed
  public get items(): QuickOpenItem[] {
    return this._items || [];
  }

  @observable
  private _inputPlaceholder?: string;

  @computed
  get inputPlaceholder() {
    return this._inputPlaceholder;
  }

  @observable
  private _inputEnable?: boolean;

  @computed
  get inputEnable() {
    return this._inputEnable;
  }

  @computed
  get actionProvider() {
    return this._actionProvider;
  }

  @computed
  get autoFocus() {
    return this._autoFocus;
  }

  public renderTab?: () => React.ReactNode;
  public toggleTab?: () => void;

  constructor(public callbacks: IQuickOpenCallbacks) {}

  @action
  show(prefix: string, options: QuickOpenInputOptions): void {
    this._isShow = true;
    this.inputValue = prefix;
    this._inputPlaceholder = options.placeholder;
    this._isPassword = options.password;
    this._inputEnable = options.inputEnable;
    this._valueSelection = options.valueSelection;
    this._canSelectMany = options.canSelectMany;
    this.renderTab = options.renderTab;
    this.toggleTab = options.toggleTab;
    // 获取第一次要展示的内容
    this.callbacks.onType(prefix);
  }

  @action
  hide(reason?: HideReason): void {
    if (!this._isShow) {
      return;
    }

    this._isShow = false;
    this._items = [];

    // Callbacks
    if (reason === HideReason.ELEMENT_SELECTED) {
      this.callbacks.onOk();
    } else {
      this.callbacks.onCancel();
    }

    this.callbacks.onHide(reason!);
  }

  @action
  blur() {
    if (!this._isShow) {
      return;
    }
    // 判断移出焦点后是否需要关闭组件
    const keepShow = this.callbacks.onFocusLost();
    if (!keepShow) {
      this.hide(HideReason.FOCUS_LOST);
    }
  }

  @action
  setInput(model: IQuickOpenModel, autoFocus: IAutoFocus, ariaLabel?: string): void {
    this._items = model.items;
    this._actionProvider = model.actionProvider;
    this._autoFocus = autoFocus;
  }
}
