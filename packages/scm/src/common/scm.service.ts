import { Injectable } from '@ali/common-di';
import { Event, Emitter, equals, getLogger } from '@ali/ide-core-common';

import { ISCMProvider, ISCMInput, ISCMRepository, IInputValidator, ISCMResourceGroup, ISCMResource } from './scm';
import { ISequence, ISpliceable, ISplice } from '@ali/ide-core-common/lib/sequence';
import { IDisposable, toDisposable, combinedDisposable, dispose } from '@ali/ide-core-common/lib/lifecycle';
import { observable } from 'mobx';

class SCMInput implements ISCMInput {

  private _value = '';

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._value = value;
    this._onDidChange.fire(value);
  }

  private _onDidChange = new Emitter<string>();
  readonly onDidChange: Event<string> = this._onDidChange.event;

  private _placeholder = '';

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(placeholder: string) {
    this._placeholder = placeholder;
    this._onDidChangePlaceholder.fire(placeholder);
  }

  private _onDidChangePlaceholder = new Emitter<string>();
  readonly onDidChangePlaceholder: Event<string> = this._onDidChangePlaceholder.event;

  private _visible = true;

  get visible(): boolean {
    return this._visible;
  }

  set visible(visible: boolean) {
    this._visible = visible;
    this._onDidChangeVisibility.fire(visible);
  }

  private _onDidChangeVisibility = new Emitter<boolean>();
  readonly onDidChangeVisibility: Event<boolean> = this._onDidChangeVisibility.event;

  private _validateInput: IInputValidator = () => Promise.resolve(undefined);

  get validateInput(): IInputValidator {
    return this._validateInput;
  }

  set validateInput(validateInput: IInputValidator) {
    this._validateInput = validateInput;
    this._onDidChangeValidateInput.fire();
  }

  private _onDidChangeValidateInput = new Emitter<void>();
  readonly onDidChangeValidateInput: Event<void> = this._onDidChangeValidateInput.event;
}

class SCMRepository implements ISCMRepository {

  private _onDidFocus = new Emitter<void>();
  readonly onDidFocus: Event<void> = this._onDidFocus.event;

  private _selected = false;
  get selected(): boolean {
    return this._selected;
  }

  private _onDidChangeSelection = new Emitter<boolean>();
  readonly onDidChangeSelection: Event<boolean> = this._onDidChangeSelection.event;

  readonly input: ISCMInput = new SCMInput();

  constructor(
    public readonly provider: ISCMProvider,
    private disposable: IDisposable,
  ) { }

  focus(): void {
    this._onDidFocus.fire();
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._onDidChangeSelection.fire(selected);
  }

  dispose(): void {
    this.disposable.dispose();
    this.provider.dispose();
  }
}

@Injectable()
export class SCMService {
  _serviceBrand: any;

  public selectedRepositories: ISCMRepository[] = [];

  private _providerIds = new Set<string>();
  private _repositories: ISCMRepository[] = [];
  get repositories(): ISCMRepository[] { return [...this._repositories]; }

  private _onDidChangeSelectedRepositories = new Emitter<ISCMRepository[]>();
  readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]> = this._onDidChangeSelectedRepositories.event;

  private _onDidAddProvider = new Emitter<ISCMRepository>();
  readonly onDidAddRepository: Event<ISCMRepository> = this._onDidAddProvider.event;

  private _onDidRemoveProvider = new Emitter<ISCMRepository>();
  readonly onDidRemoveRepository: Event<ISCMRepository> = this._onDidRemoveProvider.event;

  private readonly logger = getLogger();

  registerSCMProvider(provider: ISCMProvider): ISCMRepository {
    this.logger.log('SCMService#registerSCMProvider');

    if (this._providerIds.has(provider.id)) {
      throw new Error(`SCM Provider ${provider.id} already exists.`);
    }

    this._providerIds.add(provider.id);

    const disposable = toDisposable(() => {
      const index = this._repositories.indexOf(repository);

      if (index < 0) {
        return;
      }

      selectedDisposable.dispose();
      this._providerIds.delete(provider.id);
      this._repositories.splice(index, 1);
      this._onDidRemoveProvider.fire(repository);
      this.onDidChangeSelection();
    });

    const repository = new SCMRepository(provider, disposable);
    const selectedDisposable = repository.onDidChangeSelection(this.onDidChangeSelection, this);

    this._repositories.push(repository);
    this._onDidAddProvider.fire(repository);

    // automatically select the first repository
    if (this._repositories.length === 1) {
      repository.setSelected(true);
    }

    return repository;
  }

  private onDidChangeSelection(): void {
    const selectedRepositories = this._repositories.filter((r) => r.selected);

    if (equals(this.selectedRepositories, selectedRepositories)) {
      return;
    }

    this.selectedRepositories = this._repositories.filter((r) => r.selected);

    this._onDidChangeSelectedRepositories.fire(this.selectedRepositories);
  }
}

interface IGroupItem {
  readonly group: ISCMResourceGroup;
  visible: boolean;
  readonly disposable: IDisposable;
}

function isGroupVisible(group: ISCMResourceGroup) {
  return group.elements.length > 0 || !group.hideWhenEmpty;
}

export class ResourceGroupSplicer {
  @observable
  public items = observable.array<IGroupItem>([]);

  private disposables: IDisposable[] = [];

  constructor(groupSequence: ISequence<ISCMResourceGroup>) {
    groupSequence.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
    this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: groupSequence.elements });
  }

  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    const itemsToInsert: IGroupItem[] = [];
    const absoluteToInsert: Array<ISCMResourceGroup | ISCMResource> = [];

    for (const group of toInsert) {
      const visible = isGroupVisible(group);

      if (visible) {
        absoluteToInsert.push(group);
      }

      for (const element of group.elements) {
        absoluteToInsert.push(element);
      }

      const disposable = combinedDisposable([
        group.onDidChange(() => this.onDidChangeGroup(group)),
        group.onDidSplice((splice) => this.onDidSpliceGroup(group, splice)),
      ]);

      itemsToInsert.push({ group, visible, disposable });
    }

    const itemsToDispose = this.items.splice(start, deleteCount, ...itemsToInsert);

    for (const item of itemsToDispose) {
      item.disposable.dispose();
    }
  }

  private onDidChangeGroup(group: ISCMResourceGroup): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (item.visible === visible) {
      return;
    }

    item.visible = visible;
  }

  private onDidSpliceGroup(group: ISCMResourceGroup, { start, deleteCount, toInsert }: ISplice<ISCMResource>): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (!item.visible && !visible) {
      return;
    }

    item.visible = visible;
  }

  dispose(): void {
    this.onDidSpliceGroups({ start: 0, deleteCount: this.items.length, toInsert: [] });
    this.disposables = dispose(this.disposables);
  }
}
