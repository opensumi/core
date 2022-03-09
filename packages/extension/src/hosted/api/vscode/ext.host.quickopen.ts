import type vscode from 'vscode';

import { IRPCProtocol } from '@opensumi/ide-connection';
import {
  CancellationToken,
  hookCancellationToken,
  Event,
  Emitter,
  DisposableCollection,
  MaybePromise,
  isUndefined,
} from '@opensumi/ide-core-common';
import { QuickPickItem, QuickPickOptions } from '@opensumi/ide-quick-open';

import {
  MainThreadAPIIdentifier,
  IExtHostQuickOpen,
  IMainThreadQuickOpen,
  IExtHostWorkspace,
} from '../../../common/vscode';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickOpen implements IExtHostQuickOpen {
  private _onDidSelectItem?: (handle: number) => void;

  private proxy: IMainThreadQuickOpen;
  private validateInputHandler: undefined | ((input: string) => MaybePromise<string | null | undefined>);

  private createdQuicks = new Map<number, QuickInputExt | QuickPickExt<vscode.QuickPickItem>>(); // Each quick will have a number so that we know where to fire events
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

    const pickItems = items.map((item, index) => {
      if (typeof item === 'string') {
        return {
          label: item,
          value: index,
        };
      } else {
        const quickPickItem: QuickPickItem<number> = {
          label: item.label,
          description: item.description,
          detail: item.detail,
          value: index, // handle
        };

        return quickPickItem;
      }
    });

    const quickPickPromise = this.proxy.$showQuickPick(
      sessionId,
      pickItems,
      options && {
        canPickMany: options.canPickMany,
        placeholder: options.placeHolder,
        fuzzyMatchDescription: options.matchOnDescription,
        fuzzyMatchDetail: options.matchOnDetail,
        ignoreFocusOut: options.ignoreFocusOut,
        title: (options as QuickPickOptions).title,
        buttons: (options as QuickPickOptions).buttons,
        step: (options as QuickPickOptions).step,
        totalSteps: (options as QuickPickOptions).totalSteps,
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
    const newQuickPick = new QuickPickExt(this, session);
    this.createdQuicks.set(session, newQuickPick);
    return newQuickPick as QuickPickExt<T>;
  }

  createInputBox(): vscode.InputBox {
    const session = ++this.currentQuick;
    const newInputBox = new QuickInputExt(this, session);
    this.createdQuicks.set(session, newInputBox);
    return newInputBox;
  }

  $onDidChangeValue(sessionId: number, value: string): void {
    const session = this.createdQuicks.get(sessionId);
    if (session) {
      session._fireDidChangeValue(value);
    }
  }

  $onDidTriggerButton(btnHandler: number): void {
    return (this.createdQuicks.get(this.currentQuick) as QuickPickExt<vscode.QuickPickItem>)?.attachBtn(btnHandler);
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

  $validateInput(input: string): MaybePromise<string | null | undefined> {
    if (this.validateInputHandler) {
      return this.validateInputHandler(input);
    }
    return undefined;
  }

  hideInputBox(): void {
    this.proxy.$hideQuickinput();
  }
}

class QuickPickExt<T extends vscode.QuickPickItem> implements vscode.QuickPick<T> {
  busy: boolean;
  canSelectMany: boolean;
  enabled: boolean;
  ignoreFocusOut: boolean;
  matchOnDescription: boolean;
  matchOnDetail: boolean;
  selectedItems: ReadonlyArray<T>;
  step: number | undefined;
  title: string | undefined;
  totalSteps: number | undefined;
  value: string;
  _buttons: [];
  private _items: T[];
  private _activeItems: T[];
  private _placeholder: string | undefined;
  private disposableCollection: DisposableCollection;
  private readonly _onDidHideEmitter: Emitter<void>;
  private readonly _onDidAcceptEmitter: Emitter<void>;
  private readonly _onDidChangeActiveEmitter: Emitter<T[]>;
  private readonly _onDidChangeSelectionEmitter: Emitter<T[]>;
  private readonly _onDidChangeValueEmitter: Emitter<string>;
  private readonly _onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;

  private didShow = false;

  readonly quickPickIndex: number;

  constructor(readonly quickOpen: IExtHostQuickOpen, quickPickIndex: number) {
    this.quickPickIndex = quickPickIndex;
    this._items = [];
    this._activeItems = [];
    this._placeholder = '';
    this._buttons = [];
    this.value = '';
    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push((this._onDidHideEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidAcceptEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeActiveEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeSelectionEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeValueEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidTriggerButtonEmitter = new Emitter()));
  }

  get items(): T[] {
    return this._items;
  }

  set items(activeItems: T[]) {
    this._items = activeItems;
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

class QuickInputExt implements vscode.InputBox {
  value: string;
  placeholder: string | undefined;
  password: boolean;
  buttons: readonly vscode.QuickInputButton[];
  prompt: string | undefined;
  validationMessage: string | undefined;
  title: string | undefined;
  step: number | undefined;
  totalSteps: number | undefined;
  enabled: boolean;
  busy: boolean;
  ignoreFocusOut: boolean;

  private disposableCollection: DisposableCollection;

  readonly quickInputIndex: number;

  _onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;
  _onDidChangeValueEmitter: Emitter<string>;
  _onDidAcceptEmitter: Emitter<void>;
  _onDidHideEmitter: Emitter<void>;

  constructor(readonly quickOpen: IExtHostQuickOpen, quickInputIndex: number) {
    this.buttons = [];
    this.step = 0;
    this.title = '';
    this.totalSteps = 0;
    this.value = '';
    this.prompt = '';
    this.placeholder = '';
    this.password = false;
    this.ignoreFocusOut = false;
    this.quickInputIndex = quickInputIndex;
    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push((this._onDidAcceptEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidChangeValueEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidTriggerButtonEmitter = new Emitter()));
    this.disposableCollection.push((this._onDidHideEmitter = new Emitter()));
  }

  _fireDidChangeValue(value: string) {
    this.value = value;
    this._onDidChangeValueEmitter.fire(value);
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
    this.quickOpen
      .showInputBox({
        value: this.value,
        prompt: this.prompt,
        placeHolder: this.placeholder,
        password: this.password,
        ignoreFocusOut: this.ignoreFocusOut,
        title: this.title,
        totalSteps: this.totalSteps,
        step: this.step,
      })
      .then((item) => {
        if (item) {
          this.value = item;
        }
        this._onDidAcceptEmitter.fire();
      });
  }
  hide(): void {
    this.quickOpen.hideInputBox();
  }

  dispose(): void {
    this.disposableCollection.dispose();
  }
}
