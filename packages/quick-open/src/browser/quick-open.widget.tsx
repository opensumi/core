import { action, computed, makeObservable, observable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import {
  DisposableCollection,
  EventType,
  HideReason,
  IKeyMods,
  QuickOpenActionProvider,
  QuickOpenItem,
  addDisposableListener,
} from '@opensumi/ide-core-browser';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';

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
  private _items: QuickOpenItem[] = observable.array([]);

  @computed
  public get isShow() {
    return this._isShow;
  }

  @observable.ref
  private _actionProvider: QuickOpenActionProvider | null = null;

  @observable.ref
  private _autoFocus: IAutoFocus | null = null;

  @observable
  private _isPassword = false;

  @observable
  private _keepScrollPosition = false;

  @observable
  private _busy = false;

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

  @computed
  get keepScrollPosition() {
    return this._keepScrollPosition;
  }

  @computed
  get busy() {
    return this._busy;
  }

  @Autowired(IProgressService)
  protected readonly progressService: IProgressService;

  private progressResolve?: (value: void | PromiseLike<void>) => void;

  private modifierListeners: DisposableCollection = new DisposableCollection();

  public renderTab?: () => React.ReactNode;
  public toggleTab?: () => void;

  constructor(public callbacks: IQuickOpenCallbacks) {
    makeObservable(this);
  }

  @action
  setSelectIndex(index: number) {
    this.selectIndex = index;
  }

  @action
  setInputValue(value: string) {
    this.inputValue = value;
  }

  @action
  show(prefix: string, options: QuickOpenInputOptions): void {
    this._isShow = true;
    this.inputValue = prefix;
    this._inputPlaceholder = options.placeholder;
    this._isPassword = !!options.password;
    this._inputEnable = options.inputEnable;
    this._valueSelection = options.valueSelection;
    this._canSelectMany = options.canSelectMany;
    this._keepScrollPosition = !!options.keepScrollPosition;
    this._busy = !!options.busy;
    this.renderTab = options.renderTab;
    this.toggleTab = options.toggleTab;
    // 获取第一次要展示的内容
    this.callbacks.onType(prefix);
    this.registerKeyModsListeners();
  }

  @action
  hide(reason?: HideReason): void {
    if (!this.modifierListeners.disposed) {
      this.modifierListeners.dispose();
    }

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

    this.callbacks.onHide(reason);
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
    this._actionProvider = model.actionProvider || null;
    this._autoFocus = autoFocus;
  }

  @action
  updateOptions(options: Partial<QuickOpenInputOptions>) {
    Object.keys(options).forEach((key) => {
      const privateKey = `_${key}`;
      if (Object.hasOwn(this, privateKey)) {
        this[privateKey] = options[key];
      }
    });
  }

  @action
  updateProgressStatus(visible: boolean) {
    if (visible === true) {
      this.progressService.withProgress(
        { location: VIEW_CONTAINERS.QUICKPICK_PROGRESS },
        () => new Promise<void>((resolve) => (this.progressResolve = resolve)),
      );
    } else {
      if (this.progressResolve) {
        this.progressResolve();
        this.progressResolve = undefined;
      }
    }
  }

  private registerKeyModsListeners() {
    const listener = (e: KeyboardEvent | MouseEvent) => {
      const keyMods: IKeyMods = {
        ctrlCmd: e.ctrlKey || e.metaKey,
        alt: e.altKey,
      };
      this.callbacks.onKeyMods(keyMods);
    };
    this.modifierListeners.push(addDisposableListener(window, EventType.KEY_DOWN, listener, true));
    this.modifierListeners.push(addDisposableListener(window, EventType.KEY_UP, listener, true));
    this.modifierListeners.push(addDisposableListener(window, EventType.MOUSE_DOWN, listener, true));
  }
}
