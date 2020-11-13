import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IExtHostQuickOpen, IMainThreadQuickOpen, IExtHostWorkspace } from '../../../common/vscode';
import { CancellationToken, hookCancellationToken, Event, Emitter, DisposableCollection, MaybePromise } from '@ali/ide-core-common';
import { QuickPickItem, QuickPickOptions } from '@ali/ide-quick-open';
import { QuickInputButton } from '../../../common/vscode/ext-types';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickOpen implements IExtHostQuickOpen {

  private proxy: IMainThreadQuickOpen;
  private validateInputHandler: undefined | ((input: string) => MaybePromise<string | null | undefined>);

  private createdQuicks = new Map<number, QuickInputExt | QuickPickExt<vscode.QuickPickItem>>(); // Each quick will have a number so that we know where to fire events
  private currentQuick = 0;

  constructor(
    rpc: IRPCProtocol,
    private readonly workspace: IExtHostWorkspace,
  ) {
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
      title: (options as QuickPickOptions).title,
      buttons: (options as QuickPickOptions).buttons,
      step: (options as QuickPickOptions).step,
      totalSteps: (options as QuickPickOptions).totalSteps,
    });

    const value = await hookCancellationToken<number | undefined>(token, quickPickPromise);
    let result: Item[] | Item | undefined;

    if (typeof value === 'number') {
      if (options && options.canPickMany) {
        result = Array.of(items[value]);
      } else {
        result = items[value];
      }
    }

    if (result && options && typeof options.onDidSelectItem === 'function') {
      options.onDidSelectItem(Array.isArray(result) ? result[0] : result);
    }
    return result;
  }

  async showWorkspaceFolderPick(options: vscode.WorkspaceFolderPickOptions, token: CancellationToken = CancellationToken.None) {
    const workspaceFolders = await this.workspace.resolveWorkspaceFolder();
    if (!workspaceFolders) {
      return undefined;
    }
    const pickItems = workspaceFolders.map((folder: vscode.WorkspaceFolder) => {
      const quickPickItem: QuickPickItem<number> = {
        // QuickPickItem
        label: folder.name,
        value: folder.index, // handle
      };
      return quickPickItem;
    });
    const quickPickPromise = this.proxy.$showQuickPick(pickItems, options && {
      placeholder: options.placeHolder,
      ignoreFocusOut: options.ignoreFocusOut,
    });
    const value = await hookCancellationToken<number | undefined>(token, quickPickPromise);
    return workspaceFolders.find((folder) => folder.index === value);
  }

  hideQuickPick(): void {
    this.proxy.$hideQuickPick();
  }

  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
    this.currentQuick++;
    const newQuickPick = new QuickPickExt(this, this.currentQuick);
    this.createdQuicks.set(this.currentQuick, newQuickPick);
    return newQuickPick as QuickPickExt<T>;
  }

  createInputBox(): vscode.InputBox {
    this.currentQuick++;
    const newInputBox = new QuickInputExt(this, this.currentQuick);
    this.createdQuicks.set(this.currentQuick, newInputBox);
    return newInputBox;
  }

  $onDidTriggerButton(btnHandler: number): void {
    return (this.createdQuicks.get(this.currentQuick) as QuickPickExt<vscode.QuickPickItem> )?.attachBtn(btnHandler);
  }

  showInputBox(options: vscode.InputBoxOptions = {}, token: CancellationToken = CancellationToken.None): PromiseLike<string | undefined> {
    // 校验函数需要运行在扩展进程中
    this.validateInputHandler = options && options.validateInput;
    this.hideInputBox();

    const promise = this.proxy.$showQuickInput(options as vscode.QuickPickOptions , typeof this.validateInputHandler === 'function');
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
  private readonly onDidHideEmitter: Emitter<void>;
  private readonly onDidAcceptEmitter: Emitter<void>;
  private readonly onDidChangeActiveEmitter: Emitter<T[]>;
  private readonly onDidChangeSelectionEmitter: Emitter<T[]>;
  private readonly onDidChangeValueEmitter: Emitter<string>;
  private readonly onDidTriggerButtonEmitter: Emitter<QuickInputButton>;

  private didShow = false;

  readonly quickPickIndex: number;

  constructor(readonly quickOpen: IExtHostQuickOpen, quickPickIndex: number) {
    this.quickPickIndex = quickPickIndex;
    this._items = [];
    this._activeItems = [];
    this._placeholder = '';
    this._buttons = [];
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
    // 说明是先 show，再设置 item
    if (this.didShow) {
      this.quickOpen.hideQuickPick();
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

  get buttons() {
    return this._buttons;
  }

  set buttons(buttons) {
    this._buttons = buttons;
  }

  get onDidTriggerButton(): Event<QuickInputButton> {
    return this.onDidTriggerButtonEmitter.event;
  }

  get onDidHide(): Event<void> {
    return this.onDidHideEmitter.event;
  }

  dispose(): void {
    this.disposableCollection.dispose();
  }

  attachBtn(btnHandler: number): void {
    const btn = this.buttons[btnHandler];
    return this.onDidTriggerButtonEmitter.fire(btn);
  }

  hide(): void {
    this.quickOpen.hideQuickPick();
    this.dispose();
  }

  show(): void {
    this.didShow = true;
    const hide = () => {
      this.onDidHideEmitter.fire(undefined);
    };
    const selectItem = (item: T) => {
      this.selectedItems = this.activeItems = [item];
      this.onDidAcceptEmitter.fire(undefined);
      this.onDidChangeSelectionEmitter.fire([item]);
    };

    this.quickOpen.showQuickPick(this.items.map((item) => item as T), {
      canPickMany: this.canSelectMany,
      // tslint:disable-next-line:no-any
      onDidSelectItem(item: T | string): any {
        if (typeof item !== 'string') {
          selectItem(item);
        }
        hide();
      },
      title: this.title,
      step: this.step,
      totalSteps: this.totalSteps,
      buttons: this.buttons,
      placeHolder: this.placeholder,
    } as QuickPickOptions );
  }

}

class QuickInputExt implements vscode.InputBox {
  value: string;
  placeholder: string | undefined;
  password: boolean;
  buttons: readonly QuickInputButton[];
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

  onDidTriggerButtonEmitter: Emitter<QuickInputButton>;
  onDidChangeValueEmitter: Emitter<string>;
  onDidAcceptEmitter: Emitter<void>;
  onDidHideEmitter: Emitter<void>;

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

  get onDidTriggerButton(): Event<QuickInputButton> {
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
      title: this.title,
      totalSteps: this.totalSteps,
      step: this.step,
    }).then((item) => {
      if (item) {
        this.value = item;
      }
      this.onDidAcceptEmitter.fire();
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
