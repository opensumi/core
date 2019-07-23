import * as vscode from 'vscode';
import { IRPCProtocol } from '@ali/ide-connection';
import { MainThreadAPIIdentifier, IExtHostQuickPick, IMainThreadQuickPick } from '../../common';
import { CancellationToken, hookCancellationToken, Event, Emitter, DisposableCollection } from '@ali/ide-core-common';
import { QuickPickItem } from '@ali/ide-quick-open';

type Item = string | vscode.QuickPickItem;

export class ExtHostQuickPick implements IExtHostQuickPick {
  private proxy: IMainThreadQuickPick;

  constructor(rpc: IRPCProtocol) {
    this.proxy = rpc.getProxy(MainThreadAPIIdentifier.MainThreadQuickPick);
  }

  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem | undefined>;
  showQuickPick(promiseOrItems: vscode.QuickPickItem[] | Promise<vscode.QuickPickItem[]>, options?: (vscode.QuickPickOptions & { canSelectMany: true; }) | undefined, token?: CancellationToken | undefined): Promise<vscode.QuickPickItem[] | undefined>;
  showQuickPick(promiseOrItems: string[] | Promise<string[]>, options?: vscode.QuickPickOptions | undefined, token?: CancellationToken | undefined): Promise<string | undefined>;
  async showQuickPick(promiseOrItems: Item[] | Promise<Item[]>, options?: vscode.QuickPickOptions, token: CancellationToken = CancellationToken.None): Promise<Item | Item[] | undefined> {
    const items = await promiseOrItems;

    const pickItems = items.map((item) => {

      if (typeof item === 'string') {
        return item;
      } else {
        const quickPickItem: QuickPickItem<vscode.QuickPickItem> = {
          // QuickPickItem
          label: item.label,
          description: item.description,
          detail: item.detail,
          // vscode.QuickPickItem
          value: {
            label: item.label,
            description: item.description,
            detail: item.detail,
          },
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

    return hookCancellationToken<Item | undefined>(token, quickPickPromise)
      .then((value) => {
        if (value && options && typeof options.onDidSelectItem === 'function') {
          options.onDidSelectItem(value);
        }
        return value;
      });
  }

  hideQuickPick(): void {
    this.proxy.$hideQuickPick();
  }

  createQuickPick<T extends vscode.QuickPickItem>(): vscode.QuickPick<T> {
    return new QuickPickExt(this);
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

  constructor(readonly quickPick: IExtHostQuickPick) {
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
    this.quickPick.hideQuickPick();
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
    this.quickPick.showQuickPick(this.items.map((item) => item as T), {
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
