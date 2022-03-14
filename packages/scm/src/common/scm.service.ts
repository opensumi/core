import { observable, computed, action } from 'mobx';

import { Injectable } from '@opensumi/di';
import { Event, Emitter, equals, getDebugLogger } from '@opensumi/ide-core-common';
import { IDisposable, toDisposable } from '@opensumi/ide-core-common/lib/disposable';

import { ISCMProvider, ISCMInput, ISCMRepository, IInputValidator } from './scm';

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

  @observable
  private _selected = false;

  @computed
  get selected(): boolean {
    return this._selected;
  }

  private _onDidChangeSelection = new Emitter<ISCMRepository>();
  readonly onDidChangeSelection: Event<ISCMRepository> = this._onDidChangeSelection.event;

  readonly input: ISCMInput = new SCMInput();

  constructor(public readonly provider: ISCMProvider, private disposable: IDisposable) {}

  focus(): void {
    this._onDidFocus.fire();
  }

  @action
  setSelected(selected: boolean): void {
    this._selected = selected;
    this._onDidChangeSelection.fire(this);
  }

  dispose(): void {
    this.disposable.dispose();
    this.provider.dispose();
  }
}

@Injectable()
export class SCMService {
  private _selectedRepositories: ISCMRepository[] = [];
  public get selectedRepositories(): ISCMRepository[] {
    return [...this._selectedRepositories];
  }

  private _providerIds = new Set<string>();
  private _repositories: ISCMRepository[] = [];
  public get repositories(): ISCMRepository[] {
    return [...this._repositories];
  }

  private _onDidChangeSelectedRepositories = new Emitter<ISCMRepository[]>();
  public readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]> =
    this._onDidChangeSelectedRepositories.event;

  private _onDidAddProvider = new Emitter<ISCMRepository>();
  public readonly onDidAddRepository: Event<ISCMRepository> = this._onDidAddProvider.event;

  private _onDidRemoveProvider = new Emitter<ISCMRepository>();
  public readonly onDidRemoveRepository: Event<ISCMRepository> = this._onDidRemoveProvider.event;

  private readonly logger = getDebugLogger();

  public registerSCMProvider(provider: ISCMProvider): ISCMRepository {
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
      // 若当前 repo 为 selected 则重新 select 一个 repo
      if (repository.selected && this._repositories.length > 0) {
        this._repositories[0].setSelected(true);
      }
    });

    const repository = new SCMRepository(provider, disposable);
    // 过滤掉只剩下 selected#true 的事件
    const selectedDisposable = Event.filter(repository.onDidChangeSelection, (e) => e.selected)(
      this.onDidChangeSelection,
      this,
    );

    this._repositories.push(repository);
    this._onDidAddProvider.fire(repository);

    // 自动选中第一个添加的 repository
    if (this._repositories.length === 1) {
      repository.setSelected(true);
    }

    return repository;
  }

  private onDidChangeSelection(repository: ISCMRepository): void {
    if (equals(this._selectedRepositories, [repository])) {
      return;
    }

    // 将其他 repository#selected 设置为 false
    this._repositories
      .filter((n) => n !== repository)
      .forEach((repo) => {
        repo.setSelected(false);
      });

    this._selectedRepositories = this._repositories.filter((r) => r.selected);
    this._onDidChangeSelectedRepositories.fire(this.selectedRepositories);
  }
}
