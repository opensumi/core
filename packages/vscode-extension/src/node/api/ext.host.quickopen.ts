import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IExtHostQuickOpen, IMainThreadQuickOpen } from '../../common';
import { CancellationToken, hookCancellationToken, Event, Emitter, DisposableCollection, MaybePromise } from '@ali/ide-core-common';
import { QuickPickItem } from '@ali/ide-quick-open';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickOpen implements IExtHostQuickOpen {

  private proxy: IMainThreadQuickOpen;
  private validateInputHandler: undefined | ((input: string) => MaybePromise<string | null | undefined>);

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadQuickOpen);
  }

  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: (vscode.QuickPickOptions & { canSelectMany: true; }) | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<string | undefined>;
  async showQuickPick(promiseOrItems: Item[] | Promise<Item[]>, options?: vscode.QuickPickOptions, token: CancellationToken = CancellationToken.None): Promise<Item | Item[] | undefined> {
    const items = await promiseOrItems;

    const pickItems = items.map((item, index) => {

      if (typeof item === 'string') {
        return {
          label: item,
          value: index,
        };
      } else {
        const quickPickItem: QuickPickItem<number> = {
          // QuickPickItem
          label: item.label,
          description: item.description,
          detail: item.detail,
          value: index, // handle
        };

        return quickPickItem;
      }
    });

    const quickPickPromise = this.proxy.$showQuickPick(pickItems, options && {
      placeholder: options.placeHolder,
      fuzzyMatchDescription: options.matchOnDescription,
      fuzzyMatchDetail: options.matchOnDetail,
      ignoreFocusOut: options.ignoreFocusOut,
    });

    const value = await hookCancellationToken<number | undefined>(token, quickPickPromise);
    let result: Item | undefined;
    if (typeof value === 'number') {
      result = items[value];
    }

    if (result && options && typeof options.onDidSelectItem === 'function') {
      options.onDidSelectItem(result);
    }
    return result;
  }

  hideQuickPick(): void {
    this.proxy.$hideQuickPick();
  }

  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
    return new QuickPickExt(this);
  }

  createInputBox(): vscode.InputBox {
    return new QuickInputExt(this);
  }

  showInputBox(options: vscode.InputBoxOptions = {}, token: CancellationToken = CancellationToken.None): PromiseLike<string | undefined> {
    // 校验函数需要运行在扩展进程中
    this.validateInputHandler = options && options.validateInput;

    const promise = this.proxy.$showQuickInput(options, typeof this.validateInputHandler === 'function');
    return hookCancellationToken(token, promise);
  }

  $validateInput(input: string): MaybePromise<string | null | undefined> {
    if (this.validateInputHandler) {
        return Promise.resolve(this.validateInputHandler(input));
    }
    return undefined;
  }

  hideInputBox(): void {
    this.proxy.$hideQuickinput();
  }

}

class QuickPickExt<T extends vscode.QuickPickItem> implements vscode.QuickPick<T> {
  buttons: readonly vscode.QuickInputButton[];
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

  private _items: T[];
  private _activeItems: T[];
  private _placeholder: string | undefined;
  private disposableCollection: DisposableCollection;
  private readonly onDidHideEmitter: Emitter<void>;
  private readonly onDidAcceptEmitter: Emitter<void>;
  private readonly onDidChangeActiveEmitter: Emitter<T[]>;
  private readonly onDidChangeSelectionEmitter: Emitter<T[]>;
  private readonly onDidChangeValueEmitter: Emitter<string>;
  private readonly onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;

  constructor(readonly quickOpen: IExtHostQuickOpen) {
    this._items = [];
    this._activeItems = [];
    this._placeholder = '';
    this.buttons = [];
    this.step = 0;
    this.title = '';
    this.totalSteps = 0;
    this.value = '';
    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push(this.onDidHideEmitter = new Emitter());
    this.disposableCollection.push(this.onDidAcceptEmitter = new Emitter());
    this.disposableCollection.push(this.onDidChangeActiveEmitter = new Emitter());
    this.disposableCollection.push(this.onDidChangeSelectionEmitter = new Emitter());
    this.disposableCollection.push(this.onDidChangeValueEmitter = new Emitter());
    this.disposableCollection.push(this.onDidTriggerButtonEmitter = new Emitter());
  }

  get items(): T[] {
    return this._items;
  }

  set items(activeItems: T[]) {
    this._items = activeItems;
  }

  get activeItems(): T[] {
    return this._activeItems;
  }

  set activeItems(activeItems: T[]) {
    this._activeItems = activeItems;
  }

  get onDidAccept(): Event<void> {
    return this.onDidAcceptEmitter.event;
  }

  get placeholder(): string | undefined {
    return this._placeholder;
  }
  set placeholder(placeholder: string | undefined) {
    this._placeholder = placeholder;
  }

  get onDidChangeActive(): Event<T[]> {
    return this.onDidChangeActiveEmitter.event;
  }

  get onDidChangeSelection(): Event<T[]> {
    return this.onDidChangeSelectionEmitter.event;
  }

  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }

  get onDidTriggerButton(): Event<vscode.QuickInputButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  get onDidHide(): Event<void> {
    return this.onDidHideEmitter.event;
  }

  dispose(): void {
    this.disposableCollection.dispose();
  }

  hide(): void {
    this.quickOpen.hideQuickPick();
    this.dispose();
  }

  show(): void {
    const hide = () => {
      this.onDidHideEmitter.fire(undefined);
    };
    const selectItem = (item: T) => {
      this.activeItems = [item];
      this.onDidAcceptEmitter.fire(undefined);
      this.onDidChangeSelectionEmitter.fire([item]);
    };
    this.quickOpen.showQuickPick(this.items.map((item) => item as T), {
      // tslint:disable-next-line:no-any
      onDidSelectItem(item: T | string): any {
        if (typeof item !== 'string') {
          selectItem(item);
        }
        hide();
      }, placeHolder: this.placeholder,
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

  onDidTriggerButtonEmitter: Emitter<vscode.QuickInputButton>;
  onDidChangeValueEmitter: Emitter<string>;
  onDidAcceptEmitter: Emitter<void>;
  onDidHideEmitter: Emitter<void>;

  constructor(readonly quickOpen: IExtHostQuickOpen) {
    this.buttons = [];
    this.step = 0;
    this.title = '';
    this.totalSteps = 0;
    this.value = '';
    this.prompt = '';
    this.placeholder = '';
    this.password = false;
    this.ignoreFocusOut = false;
    this.disposableCollection = new DisposableCollection();
    this.disposableCollection.push(this.onDidAcceptEmitter = new Emitter());
    this.disposableCollection.push(this.onDidChangeValueEmitter = new Emitter());
    this.disposableCollection.push(this.onDidTriggerButtonEmitter = new Emitter());
    this.disposableCollection.push(this.onDidHideEmitter = new Emitter());
  }

  get onDidChangeValue(): Event<string> {
    return this.onDidChangeValueEmitter.event;
  }

  get onDidAccept(): Event<void> {
    return this.onDidAcceptEmitter.event;
  }

  get onDidTriggerButton(): Event<vscode.QuickInputButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  get onDidHide(): Event<void> {
    return this.onDidHideEmitter.event;
  }

  show(): void {
    this.quickOpen.showInputBox({
      value: this.value,
      prompt: this.prompt,
      placeHolder: this.placeholder,
      password: this.password,
      ignoreFocusOut: this.ignoreFocusOut,
    });

  }
  hide(): void {
    this.quickOpen.hideInputBox();
    this.dispose();
  }

  dispose(): void {
    this.disposableCollection.dispose();
  }

}
