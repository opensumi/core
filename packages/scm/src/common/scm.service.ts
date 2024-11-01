import { Injectable } from '@opensumi/di';
import { IInputBaseProps } from '@opensumi/ide-components';
import {
  DisposableStore,
  Emitter,
  Event,
  IDisposable,
  arrays,
  getDebugLogger,
  toDisposable,
} from '@opensumi/ide-core-common';

import { IInputValidator, ISCMInput, ISCMInputActionButtonDescriptor, ISCMProvider, ISCMRepository } from './scm';

const { equals } = arrays;
class SCMInput implements ISCMInput, IDisposable {
  private _disposables = new DisposableStore();
  private _value = '';

  get value(): string {
    return this._value;
  }

  set value(value: string) {
    this._value = value;
    this._onDidChange.fire(value);
  }

  private _onDidChange = this._disposables.add(new Emitter<string>());
  readonly onDidChange: Event<string> = this._onDidChange.event;

  private _placeholder = '';

  get placeholder(): string {
    return this._placeholder;
  }

  set placeholder(placeholder: string) {
    this._placeholder = placeholder;
    this._onDidChangePlaceholder.fire(placeholder);
  }

  private _onDidChangePlaceholder = this._disposables.add(new Emitter<string>());
  readonly onDidChangePlaceholder: Event<string> = this._onDidChangePlaceholder.event;

  private _visible = true;

  get visible(): boolean {
    return this._visible;
  }

  set visible(visible: boolean) {
    this._visible = visible;
    this._onDidChangeVisibility.fire(visible);
  }

  private _props = {};

  get props(): IInputBaseProps {
    return this._props;
  }

  set props(props: IInputBaseProps) {
    this._props = props;
    this._onDidChangeProps.fire(this._props);
  }

  public appendProps(props: IInputBaseProps): void {
    this._props = { ...this._props, ...props };
    this._onDidChangeProps.fire(this._props);
  }

  private _onDidChangeProps = this._disposables.add(new Emitter<IInputBaseProps>());
  readonly onDidChangeProps: Event<IInputBaseProps> = this._onDidChangeProps.event;

  private _onDidChangeVisibility = this._disposables.add(new Emitter<boolean>());
  readonly onDidChangeVisibility: Event<boolean> = this._onDidChangeVisibility.event;

  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(enabled: boolean) {
    this._enabled = enabled;
    this._onDidChangeEnablement.fire(enabled);
  }

  private readonly _onDidChangeEnablement = this._disposables.add(new Emitter<boolean>());
  readonly onDidChangeEnablement: Event<boolean> = this._onDidChangeEnablement.event;

  private _validateInput: IInputValidator = () => Promise.resolve(undefined);

  get validateInput(): IInputValidator {
    return this._validateInput;
  }

  set validateInput(validateInput: IInputValidator) {
    this._validateInput = validateInput;
    this._onDidChangeValidateInput.fire();
  }

  private _onDidChangeValidateInput = this._disposables.add(new Emitter<void>());
  readonly onDidChangeValidateInput: Event<void> = this._onDidChangeValidateInput.event;

  private _actionButton: ISCMInputActionButtonDescriptor | undefined;

  get actionButton(): ISCMInputActionButtonDescriptor | undefined {
    return this._actionButton;
  }

  set actionButton(actionButton: ISCMInputActionButtonDescriptor | undefined) {
    this._actionButton = actionButton;
    this._onDidChangeActionButton.fire();
  }

  private _onDidChangeActionButton = this._disposables.add(new Emitter<void>());
  readonly onDidChangeActionButton: Event<void> = this._onDidChangeActionButton.event;

  dispose(): void {
    this._disposables.dispose();
  }
}

class SCMRepository implements ISCMRepository, IDisposable {
  private _disposables = new DisposableStore();

  private _onDidFocus = this._disposables.add(new Emitter<void>());
  readonly onDidFocus: Event<void> = this._onDidFocus.event;

  private _selected = false;

  get selected(): boolean {
    return this._selected;
  }

  private _onDidChangeSelection = this._disposables.add(new Emitter<ISCMRepository>());
  readonly onDidChangeSelection: Event<ISCMRepository> = this._onDidChangeSelection.event;

  readonly input: ISCMInput = new SCMInput();

  constructor(public readonly provider: ISCMProvider, private disposable: IDisposable) {}

  focus(): void {
    this._onDidFocus.fire();
  }

  setSelected(selected: boolean): void {
    this._selected = selected;
    this._onDidChangeSelection.fire(this);
  }

  dispose(): void {
    this._disposables.dispose();
    this.disposable.dispose();
    this.provider.dispose();
    this.input.dispose();
  }
}

@Injectable()
export class SCMService implements IDisposable {
  private _disposables = new DisposableStore();

  private _selectedRepositories: ISCMRepository[] = [];
  public get selectedRepositories(): ISCMRepository[] {
    return [...this._selectedRepositories];
  }

  private _providerIds = new Set<string>();
  private _repositories: ISCMRepository[] = [];
  public get repositories(): ISCMRepository[] {
    return [...this._repositories];
  }

  private _onDidChangeSelectedRepositories = this._disposables.add(new Emitter<ISCMRepository[]>());
  public readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]> =
    this._onDidChangeSelectedRepositories.event;

  private _onDidAddProvider = this._disposables.add(new Emitter<ISCMRepository>());
  public readonly onDidAddRepository: Event<ISCMRepository> = this._onDidAddProvider.event;

  private _onDidRemoveProvider = this._disposables.add(new Emitter<ISCMRepository>());
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

  public setInputProps(props: IInputBaseProps): void {
    this._repositories.forEach((repo) => {
      repo.input.props = props;
    });
  }

  public appendInputProps(props: IInputBaseProps): void {
    this._repositories.forEach((repo) => {
      repo.input.appendProps(props);
    });
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

  dispose(): void {
    this._disposables.dispose();
  }
}
