import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  CancellationToken,
  Disposable,
  DisposableCollection,
  Emitter,
  Event,
  MaybePromise,
  hookCancellationToken,
  isUndefined,
} from '@opensumi/ide-core-common';
import {
  QuickInputButton,
  QuickInputOptions,
  QuickPickItem,
  QuickPickOptions,
  QuickTitleButton,
} from '@opensumi/ide-quick-open';

import {
  IExtHostQuickOpen,
  IExtHostWorkspace,
  IMainThreadQuickOpen,
  MainThreadAPIIdentifier,
  Severity,
} from '../../../common/vscode';
import { QuickPickItemKind } from '../../../common/vscode/ext-types';

import type vscode from 'vscode';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickOpen implements IExtHostQuickOpen {
  private _onDidSelectItem?: (handle: number) => void;

  private proxy: IMainThreadQuickOpen;
  private validateInputHandler:
    | undefined
    | ((input: string) => MaybePromise<string | vscode.InputBoxValidationMessage | null | undefined>);

  private createdQuicks = new Map<number, ExtQuickPick<vscode.QuickPickItem>>(); // Each quick will have a number so that we know where to fire events
  private createdInputBoxes = new Map<number, ExtQuickInput>();
  private currentQuick = 0;

  constructor(rpc: IRPCProtocol, private readonly workspace: IExtHostWorkspace) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadQuickOpen);
  }

  showQuickPick(
    promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>,
    options?: vscode.QuickPickOptions | undefined,
    token?: CancellationToken | undefined,
  ): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(
    promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>,
    options?: (vscode.QuickPickOptions & { canSelectMany: true }) | undefined,
    token?: CancellationToken | undefined,
  ): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(
    promiseOrItems: string[] | Promise<string[]>,
    options?: vscode.QuickPickOptions | undefined,
    token?: CancellationToken | undefined,
  ): Promise<string | undefined>;
  async showQuickPick(
    promiseOrItems: Item[] | Promise<Item[]>,
    options?: vscode.QuickPickOptions,
    token: CancellationToken = CancellationToken.None,
  ): Promise<Item | Item[] | undefined> {
    // clear state from last invocation
    this._onDidSelectItem = undefined;
    const sessionId = (options as any)?._sessionId ?? ++this.currentQuick;
    const items = await promiseOrItems;

    // handle selection changes
    if (options && typeof options.onDidSelectItem === 'function') {
      this._onDidSelectItem = (handle) => {
        options.onDidSelectItem!(items[handle]);
      };
    }

    const pickItems: QuickPickItem<number>[] = [];
    const pendingGroupItem: vscode.QuickPickItem[] = [];
    for (const [index, item] of items.entries()) {
      if (typeof item === 'string') {
        pickItems.push({
          label: item,
          value: index,
        });
      } else {
        if (item.kind === QuickPickItemKind.Separator) {
          pendingGroupItem.push(item);
        } else {
          // group label 取上一个 kind 为 Separator 的 item label
          const groupLabel = pendingGroupItem.pop()?.label;
          pickItems.push({
            label: item.label,
            groupLabel,
            iconPath: item.iconPath as QuickPickItem<number>['iconPath'],
            description: item.description,
            detail: item.detail,
            value: index, // handle
            buttons: item.buttons as QuickInputButton[],
            showBorder: typeof groupLabel !== 'undefined',
          });
        }
      }
    }

    const quickPickPromise = this.proxy.$showQuickPick(
      sessionId,
      pickItems,
      options && {
        canPickMany: options.canPickMany,
        placeholder: options.placeHolder,
        fuzzyMatchDescription: options.matchOnDescription,
        fuzzyMatchDetail: options.matchOnDetail,
        ignoreFocusOut: options.ignoreFocusOut,
        keepScrollPosition: options.keepScrollPosition,
        title: (options as QuickPickOptions).title,
        buttons: (options as QuickPickOptions).buttons,
        step: (options as QuickPickOptions).step,
        totalSteps: (options as QuickPickOptions).totalSteps,
        value: (options as QuickPickOptions).value,
      },
    );

    const value = await hookCancellationToken<number | number[] | undefined>(token, quickPickPromise);

    if (isUndefined(value)) {
      return;
    }

    return Array.isArray(value) ? value.map((index) => items[index]) : items[value];
  }

  $onItemSelected(handle: number): void {
    if (this._onDidSelectItem) {
      this._onDidSelectItem(handle);
    }
  }

  async showWorkspaceFolderPick(
    options: vscode.WorkspaceFolderPickOptions,
    token: CancellationToken = CancellationToken.None,
  ) {
    const workspaceFolders = await this.workspace.resolveWorkspaceFolder();
    if (!workspaceFolders) {
      return undefined;
    }
    const session = ++this.currentQuick;
    const pickItems = workspaceFolders.map((folder: vscode.WorkspaceFolder) => {
      const quickPickItem: QuickPickItem<number> = {
        label: folder.name,
        value: folder.index, // handle
      };
      return quickPickItem;
    });
    const quickPickPromise = this.proxy.$showQuickPick(
      session,
      pickItems,
      options && {
        placeholder: options.placeHolder,
        ignoreFocusOut: options.ignoreFocusOut,
      },
    );
    const value = await hookCancellationToken<number | undefined>(token, quickPickPromise);
    return workspaceFolders.find((folder) => folder.index === value);
  }

  hideQuickPick(): void {
    this.proxy.$hideQuickPick();
  }

  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
    const session = ++this.currentQuick;
    const newQuickPick = new ExtQuickPick(this, session);
    this.createdQuicks.set(session, newQuickPick);
    return newQuickPick as ExtQuickPick<T>;
  }

  createInputBox(): vscode.InputBox {
    const session = ++this.currentQuick;
    const newInputBox = new ExtInputBox(session, this.proxy, this, () => {
      this.createdInputBoxes.delete(session);
    });
    this.createdInputBoxes.set(session, newInputBox);
    return newInputBox;
  }

  $onDidChangeValue(sessionId: number, value: string): void {
    const session = this.createdQuicks.get(sessionId);
    if (session) {
      session._fireDidChangeValue(value);
    }
  }

  $onCreatedInputBoxDidChangeValue(sessionId: number, value: string): void {
    const session = this.createdInputBoxes.get(sessionId);
    if (session) {
      session._fireDidChangeValue(value);
    }
  }
  $onCreatedInputBoxDidAccept(sessionId: number): void {
    const session = this.createdInputBoxes.get(sessionId);
    if (session) {
      session._fireDidAccept();
    }
  }
  $onCreatedInputBoxDidHide(sessionId: number): void {
    const session = this.createdInputBoxes.get(sessionId);
    if (session) {
      session._fireDidHide();
    }
  }
  $onCreatedInputBoxDidTriggerButton(sessionId: number, btnHandler: number) {
    const session = this.createdInputBoxes.get(sessionId);
    if (session) {
      session._fireDidTriggerButton(btnHandler);
    }
  }
  $onDidTriggerButton(btnHandler: number): void {
    return (this.createdQuicks.get(this.currentQuick) as ExtQuickPick<vscode.QuickPickItem>)?.attachBtn(btnHandler);
  }
  $onDidTriggerItemButton(itemHandler: number, btnHandler: number): void {
    return (this.createdQuicks.get(this.currentQuick) as ExtQuickPick<vscode.QuickPickItem>)?.attachItemBtn(
      itemHandler,
      btnHandler,
    );
  }
  showInputBox(
    options: vscode.InputBoxOptions = {},
    token: CancellationToken = CancellationToken.None,
  ): PromiseLike<string | undefined> {
    // 校验函数需要运行在扩展进程中
    this.validateInputHandler = options && options.validateInput;
    this.hideInputBox();

    const promise = this.proxy.$showQuickInput(
      options as vscode.QuickPickOptions,
      typeof this.validateInputHandler === 'function',
    );
    return hookCancellationToken(token, promise);
  }

  $validateInput(input: string): MaybePromise<string | { message: string; severity: Severity } | null | undefined> {
    if (this.validateInputHandler) {
      return this.validateInputHandler(input) as MaybePromise<
        string | { message: string; severity: Severity } | null | undefined
      >;
    }
    return undefined;
  }

  hideInputBox(): void {
    this.proxy.$hideQuickInput();
  }
}

class ExtQuickPick<T extends vscode.QuickPickItem> implements vscode.QuickPick<T> {
  busy: boolean;
  canSelectMany: boolean;
  enabled: boolean;
  ignoreFocusOut: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  keepScrollPosition?: boolean | undefined;
  selectedItems: ReadonlyArray<T>;
  step: number | undefined;
  title: string | undefined;
  totalSteps: number | undefined;
  value = '';
  _buttons: [] = [];
  private _items: T[] = [];
  private _handlesToItems: Map<number, T> = new Map();
  private _itemsToHandles: Map<T, number> = new Map();
  private _activeItems: T[] = [];
  private _placeholder: string | undefined = '';
  private disposableCollection: DisposableCollection;
  private readonly _onDidHideEmitter: Emitter<void>;
  private readonly _onDidAcceptEmitter: Emitter<void>;
  private readonly _onDidChangeActiveEmitter: Emitter<T[]>;
  private readonly _onDidChangeSelectionEmitter: Emitter<T[]>;
  private readonly _onDidChangeValueEmitter: Emitter<string>;
  private readonly _onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;
  private readonly _onDidTriggerItemButtonEmitter: Emitter<vscode.QuickPickItemButtonEvent<T>>;

  private didShow = false;

  readonly quickPickIndex: number;

  constructor(readonly quickOpen: IExtHostQuickOpen, quickPickIndex: number) {
    this.quickPickIndex = quickPickIndex;
    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push((this._onDidHideEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidAcceptEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeActiveEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeSelectionEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeValueEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidTriggerButtonEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidTriggerItemButtonEmitter = new Emitter()));
  }

  get items(): T[] {
    return this._items;
  }

  set items(activeItems: T[]) {
    this._items = activeItems;
    this._handlesToItems.clear();
    this._itemsToHandles.clear();
    this._items.forEach((item, i) => {
      this._handlesToItems.set(i, item);
      this._itemsToHandles.set(item, i);
    });

    // 说明是先 show，再设置 item
    if (this.didShow) {
      this.show();
    }
  }

  get activeItems(): T[] {
    return this._activeItems;
  }

  set activeItems(activeItems: T[]) {
    this._activeItems = activeItems;
  }

  get onDidAccept(): Event<void> {
    return this._onDidAcceptEmitter.event;
  }

  get placeholder(): string | undefined {
    return this._placeholder;
  }
  set placeholder(placeholder: string | undefined) {
    this._placeholder = placeholder;
  }

  get onDidChangeActive(): Event<T[]> {
    return this._onDidChangeActiveEmitter.event;
  }

  get onDidChangeSelection(): Event<T[]> {
    return this._onDidChangeSelectionEmitter.event;
  }

  get onDidChangeValue(): Event<string> {
    return this._onDidChangeValueEmitter.event;
  }

  get buttons() {
    return this._buttons;
  }

  set buttons(buttons) {
    this._buttons = buttons;
  }

  get onDidTriggerButton(): Event<vscode.QuickInputButton> {
    return this._onDidTriggerButtonEmitter.event;
  }

  get onDidTriggerItemButton(): Event<vscode.QuickPickItemButtonEvent<T>> {
    return this._onDidTriggerItemButtonEmitter.event;
  }

  _fireDidChangeValue(value: string) {
    this.value = value;
    this._onDidChangeValueEmitter.fire(value);
  }

  get onDidHide(): Event<void> {
    return this._onDidHideEmitter.event;
  }

  dispose(): void {
    this.disposableCollection.dispose();
  }

  attachBtn(btnHandler: number): void {
    const btn = this.buttons[btnHandler];
    return this._onDidTriggerButtonEmitter.fire(btn);
  }

  attachItemBtn(itemhandler: number, btnHandler: number): void {
    const item = this._handlesToItems.get(itemhandler);
    if (!item || !item.buttons || !item.buttons.length) {
      return;
    }

    const button = item.buttons[btnHandler];
    if (button) {
      return this._onDidTriggerItemButtonEmitter.fire({
        button,
        item,
      });
    }
  }

  hide(): void {
    this.quickOpen.hideQuickPick();
  }

  show(): void {
    this.didShow = true;
    const hide = () => {
      this._onDidHideEmitter.fire(undefined);
    };
    const selectItem = (item: T | T[]) => {
      const selectedItems = Array.isArray(item) ? item : [item];
      this.selectedItems = this.activeItems = selectedItems;
      this._onDidAcceptEmitter.fire(undefined);
      this._onDidChangeSelectionEmitter.fire(selectedItems);
    };

    this.quickOpen
      .showQuickPick(
        this.items.map((item) => item as T),
        {
          canPickMany: this.canSelectMany,
          title: this.title,
          step: this.step,
          totalSteps: this.totalSteps,
          buttons: this.buttons,
          placeHolder: this.placeholder,
          ignoreFocusOut: this.ignoreFocusOut,
          _sessionId: this.quickPickIndex,
          keepScrollPosition: this.keepScrollPosition,
          value: this.value,
        } as QuickPickOptions,
      )
      .then((item) => {
        if (!isUndefined(item)) {
          selectItem(item as T | T[]);
        }
        hide();
      });
  }
}

type QuickInputType = 'quickPick' | 'inputBox';

abstract class ExtQuickInput implements vscode.InputBox {
  abstract type: QuickInputType;

  private _value: string;
  private _placeholder: string | undefined;
  private _password: boolean;
  private _buttons: vscode.QuickInputButton[];
  private _prompt: string | undefined;
  private _validationMessage: string | vscode.InputBoxValidationMessage | undefined;
  private _title: string | undefined;
  private _step: number | undefined;
  private _totalSteps: number | undefined;
  private _enabled: boolean;
  private _busy: boolean;
  private _ignoreFocusOut: boolean;
  private _hideOnDidAccept: boolean;

  private disposableCollection: DisposableCollection;

  private _onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;
  private _onDidChangeValueEmitter: Emitter<string>;
  private _onDidAcceptEmitter: Emitter<void>;
  private _onDidHideEmitter: Emitter<void>;

  private _updateTimeout: any;
  private _disposed = false;

  private _pendingUpdate: Partial<QuickInputOptions> = {};

  constructor(
    readonly _id: number,
    readonly proxy: IMainThreadQuickOpen,
    readonly quickOpen: IExtHostQuickOpen,
    onDispose: () => void,
  ) {
    this._buttons = [];
    this._step = 0;
    this._title = '';
    this._totalSteps = 0;
    this._value = '';
    this._prompt = '';
    this._placeholder = '';
    this._password = false;
    this._ignoreFocusOut = false;
    this._busy = false;
    this._hideOnDidAccept = true;

    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push((this._onDidAcceptEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeValueEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidTriggerButtonEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidHideEmitter = new Emitter()));
    this.disposableCollection.push(Disposable.create(onDispose));
  }

  get ignoreFocusOut(): boolean {
    return this._ignoreFocusOut;
  }

  set ignoreFocusOut(ignoreFocusOut: boolean) {
    this._ignoreFocusOut = ignoreFocusOut;
    this.update({ ignoreFocusOut });
  }

  get buttons(): vscode.QuickInputButton[] {
    return this._buttons;
  }

  set buttons(buttons: vscode.QuickInputButton[]) {
    // TODO: 可能是有问题的，但 MainThread 里可能是能 work 的。
    // 具体也不太好解决，涉及到：
    // - Uri 和 URI 类型不兼容
    // - iconPath, iconClass 要在这一层就拿到
    this._buttons = buttons;
    this.update({ buttons: buttons as unknown as QuickTitleButton[] });
  }

  get busy(): boolean {
    return this._busy;
  }

  set busy(busy: boolean) {
    this._busy = busy;
    this.update({ busy });
  }

  get title() {
    return this._title;
  }

  set title(title: string | undefined) {
    this._title = title;
    this.update({ title });
  }

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    this._enabled = enabled;
    this.update({ enabled });
  }

  get password(): boolean {
    return this._password;
  }

  set password(password: boolean) {
    this._password = password;
    this.update({ password });
  }

  get value(): string {
    return this._value;
  }

  // 当前设计下，输入框还不能响应插件设置的 value 值，不影响一般使用。
  set value(value: string) {
    this._value = value;
    this.update({ value });
  }

  get totalSteps(): number | undefined {
    return this._totalSteps;
  }

  set totalSteps(totalSteps: number | undefined) {
    this._totalSteps = totalSteps;
    this.update({ totalSteps });
  }

  get step(): number | undefined {
    return this._step;
  }

  set step(step: number | undefined) {
    this._step = step;
    this.update({ step });
  }

  get prompt(): string | undefined {
    return this._prompt;
  }

  set prompt(prompt: string | undefined) {
    this._prompt = prompt;
    this.update({ prompt });
  }

  get placeholder(): string | undefined {
    return this._placeholder;
  }

  set placeholder(placeHolder: string | undefined) {
    this._placeholder = placeHolder;
    this.update({ placeHolder });
  }

  get validationMessage(): string | vscode.InputBoxValidationMessage | undefined {
    return this._validationMessage;
  }

  set validationMessage(validationMessage: string | vscode.InputBoxValidationMessage | undefined) {
    this._validationMessage = validationMessage;
    if (!validationMessage) {
      this.update({ validationMessage: undefined, severity: Severity.Ignore });
    } else if (typeof validationMessage === 'string') {
      this.update({ validationMessage, severity: Severity.Error });
    } else {
      this.update({
        validationMessage: validationMessage.message,
        severity: (validationMessage.severity as unknown as Severity) ?? Severity.Error,
      });
    }
  }

  get hideOnDidAccept(): boolean {
    return this._hideOnDidAccept;
  }

  set hideOnDidAccept(hideOnDidAccept: boolean) {
    this._hideOnDidAccept = hideOnDidAccept;
    this.update({ hideOnDidAccept });
  }

  getOptions(): QuickInputOptions {
    return {
      value: this.value,
      prompt: this.prompt,
      placeHolder: this.placeholder,
      password: this.password,
      ignoreFocusOut: this.ignoreFocusOut,
      title: this._title,
      totalSteps: this.totalSteps,
      step: this.step,
      validationMessage:
        typeof this.validationMessage === 'string' ? this.validationMessage : this.validationMessage?.message,
      buttons: this.buttons as unknown as QuickTitleButton[],
      busy: this.busy,
      enabled: this.enabled,
      hideOnDidAccept: this.hideOnDidAccept,
    };
  }

  private doUpdate() {
    if (this.type === 'inputBox') {
      this.proxy.$createOrUpdateInputBox(this._id, this._pendingUpdate);
    }
    this._pendingUpdate = {};
  }

  private update(data: Partial<QuickInputOptions> & { severity?: Severity }) {
    if (this._disposed) {
      return;
    }

    for (const k of Object.keys(data)) {
      data[k] = data[k] === undefined ? null : data[k];
    }

    this._pendingUpdate = { ...this._pendingUpdate, ...data };

    if (!this._updateTimeout) {
      // Defer the update so that multiple changes to setters dont cause a redraw each
      this._updateTimeout = setTimeout(() => {
        this._updateTimeout = undefined;
        this.doUpdate();
      }, 0);
    }
  }

  _fireDidChangeValue(value: string) {
    this.value = value;
    this._onDidChangeValueEmitter.fire(value);
  }

  _fireDidAccept() {
    this._onDidAcceptEmitter.fire();
  }

  _fireDidTriggerButton(btnHandler: number) {
    this._onDidTriggerButtonEmitter.fire(this.buttons[btnHandler]);
  }

  _fireDidHide() {
    this._onDidHideEmitter.fire();
  }

  get onDidChangeValue(): Event<string> {
    return this._onDidChangeValueEmitter.event;
  }

  get onDidAccept(): Event<void> {
    return this._onDidAcceptEmitter.event;
  }

  get onDidTriggerButton(): Event<vscode.QuickInputButton> {
    return this._onDidTriggerButtonEmitter.event;
  }

  get onDidHide(): Event<void> {
    return this._onDidHideEmitter.event;
  }

  show(): void {
    this.update(this.getOptions());
  }

  hide(): void {
    if (this.type === 'inputBox') {
      this.proxy.$hideInputBox(this._id);
    }
  }

  dispose(): void {
    if (this._disposed) {
      return;
    }
    this.disposableCollection.dispose();
    if (this._updateTimeout) {
      clearTimeout(this._updateTimeout);
      this._updateTimeout = undefined;
    }
    this.proxy.$disposeInputBox(this._id);
    this._disposed = true;
  }
}

class ExtInputBox extends ExtQuickInput {
  type: QuickInputType = 'inputBox';
}
