import { Autowired, Injectable } from '@opensumi/di';
import {
  DisposableCollection,
  EventType,
  HideReason,
  IKeyMods,
  QuickOpenActionProvider,
  QuickOpenItem,
  addDisposableListener,
  isNumber,
} from '@opensumi/ide-core-browser';
import { VALIDATE_TYPE } from '@opensumi/ide-core-browser/lib/components';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { derived, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

import {
  IAutoFocus,
  IQuickOpenCallbacks,
  IQuickOpenModel,
  IQuickOpenWidget,
  QuickOpenInputOptions,
} from './quick-open.type';

@Injectable({ multiple: true })
export class QuickOpenWidget implements IQuickOpenWidget {
  @Autowired(IProgressService)
  protected readonly progressService: IProgressService;

  readonly MAX_HEIGHT = 440;
  readonly inputValue = observableValue<string>(this, '');
  readonly validateType = observableValue<VALIDATE_TYPE | undefined>(this, undefined);
  readonly isShow = observableValue<boolean>(this, false);
  readonly items = observableValue<QuickOpenItem[]>(this, []);
  readonly actionProvider = observableValue<QuickOpenActionProvider | null>(this, null);
  readonly autoFocus = observableValue<IAutoFocus | null>(this, null);
  readonly selectAll = derived(this, (reader) => this.items.read(reader).every((item) => item.checked.read(reader)));
  readonly isPassword = observableValue<boolean>(this, false);
  readonly selectIndex = observableValue<number>(this, 0);
  readonly keepScrollPosition = observableValue<boolean>(this, false);
  readonly busy = observableValue<boolean>(this, false);
  readonly valueSelection = observableValue<[number, number] | undefined>(this, undefined);
  readonly canSelectMany = observableValue<boolean | undefined>(this, false);
  readonly inputPlaceholder = observableValue<string | undefined>(this, '');
  readonly inputEnable = observableValue<boolean | undefined>(this, false);

  // Indicates whether the quick-open has been opened
  private isAlreadyOpen: boolean = false;
  private progressResolve?: (value: void | PromiseLike<void>) => void;
  private modifierListeners: DisposableCollection = new DisposableCollection();

  public renderTab?: () => React.ReactNode;
  public toggleTab?: () => void;

  constructor(readonly callbacks: IQuickOpenCallbacks) {}

  setSelectIndex(index: number) {
    transaction((tx) => {
      const safeIndex = isNumber(index) ? index : 0;
      this.selectIndex.set(safeIndex, tx);
    });
  }

  setInputValue(value: string) {
    transaction((tx) => {
      this.inputValue.set(value, tx);
    });
  }

  show(prefix: string, options: QuickOpenInputOptions): void {
    transaction((tx) => {
      if (this.isShow.get()) {
        if (!this.isAlreadyOpen) {
          // 弹框已经显示后 show 方法第一次被调用时调用
          this.isAlreadyOpen = true;
          this.callbacks.onType(prefix);
        }
      } else {
        // 弹框第一次显示时调用
        this.callbacks.onType(prefix);
      }

      this.isShow.set(true, tx);
      this.inputValue.set(prefix, tx);
      this.inputPlaceholder.set(options.placeholder, tx);
      this.isPassword.set(!!options.password, tx);
      this.inputEnable.set(options.inputEnable, tx);
      this.valueSelection.set(options.valueSelection, tx);
      this.canSelectMany.set(options.canSelectMany, tx);
      this.keepScrollPosition.set(!!options.keepScrollPosition, tx);
      this.busy.set(!!options.busy, tx);

      this.renderTab = options.renderTab;
      this.toggleTab = options.toggleTab;
      this.registerKeyModsListeners();
    });
  }

  hide(reason?: HideReason): void {
    this.isAlreadyOpen = false;

    if (!this.modifierListeners.disposed) {
      this.modifierListeners.dispose();
    }

    if (!this.isShow.get()) {
      return;
    }

    transaction((tx) => {
      this.isShow.set(false, tx);
      this.items.set([], tx);
    });

    // Callbacks
    if (reason === HideReason.ELEMENT_SELECTED) {
      this.callbacks.onOk();
    } else {
      this.callbacks.onCancel();
    }

    this.callbacks.onHide(reason);
  }

  blur() {
    if (!this.isShow.get()) {
      return;
    }
    // 判断移出焦点后是否需要关闭组件
    const keepShow = this.callbacks.onFocusLost();
    if (!keepShow) {
      this.hide(HideReason.FOCUS_LOST);
    }
  }

  setInput(model: IQuickOpenModel, autoFocus: IAutoFocus, ariaLabel?: string): void {
    transaction((tx) => {
      this.items.set(model.items, tx);
      this.actionProvider.set(model.actionProvider || null, tx);
      this.autoFocus.set(autoFocus, tx);
    });
  }

  updateOptions(options: Partial<QuickOpenInputOptions>) {
    transaction((tx) => {
      const optionsMap = {
        placeholder: (value?: string) => this.inputPlaceholder.set(value, tx),
        password: (value?: boolean) => this.isPassword.set(!!value, tx),
        inputEnable: (value?: boolean) => this.inputEnable.set(!!value, tx),
        valueSelection: (value?: [number, number]) => this.valueSelection.set(value, tx),
        canSelectMany: (value?: boolean) => this.canSelectMany.set(!!value, tx),
        keepScrollPosition: (value?: boolean) => this.keepScrollPosition.set(!!value, tx),
        busy: (value?: boolean) => this.busy.set(!!value, tx),
        enabled: (value?: boolean) => this.inputEnable.set(!!value, tx),
      };

      Object.entries(options).forEach(([key, value]) => {
        if (key in optionsMap) {
          optionsMap[key](value);
        }
      });
    });
  }

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
