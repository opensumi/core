import URI from 'vscode-uri';
import { Event, IDisposable, ISequence } from '@ali/ide-core-common';
import { ColorIdentifier } from '@ali/ide-theme';

import { Command as VSComand } from '@ali/ide-vscode-extension/lib/common/model.api';

export interface IBaselineResourceProvider {
  getBaselineResource(resource: URI): Promise<URI>;
}

// export const ISCMService = createDecorator<ISCMService>('scm');

export interface ISCMResourceDecorations {
  icon?: URI;
  iconDark?: URI;
  tooltip?: string;
  strikeThrough?: boolean;
  faded?: boolean;

  source?: string;
  letter?: string;
  color?: ColorIdentifier;
}

export interface ISCMResource {
  readonly resourceGroup: ISCMResourceGroup;
  readonly sourceUri: URI;
  readonly decorations: ISCMResourceDecorations;
  open(): Promise<void>;
}

export interface ISCMResourceGroup extends ISequence<ISCMResource> {
  readonly provider: ISCMProvider;
  readonly label: string;
  readonly id: string;
  readonly hideWhenEmpty: boolean;
  readonly onDidChange: Event<void>;
}

export interface ISCMProvider extends IDisposable {
  readonly label: string;
  readonly id: string;
  readonly contextValue: string;

  readonly groups: ISequence<ISCMResourceGroup>;

  // TODO@Joao: remove
  readonly onDidChangeResources: Event<void>;

  readonly rootUri?: URI;
  readonly count?: number;
  readonly commitTemplate?: string;
  readonly onDidChangeCommitTemplate?: Event<string>;
  readonly onDidChangeStatusBarCommands?: Event<VSComand[]>;
  readonly acceptInputCommand?: VSComand;
  readonly statusBarCommands?: VSComand[];
  readonly onDidChange: Event<void>;

  getOriginalResource(uri: URI): Promise<URI | null>;
}

export const enum InputValidationType {
  Error = 0,
  Warning = 1,
  Information = 2,
}

export interface IInputValidation {
  message: string;
  type: InputValidationType;
}

export type IInputValidator = (value: string, cursorPosition: number) => Promise<IInputValidation | undefined>;

export interface ISCMInput {
  value: string;
  readonly onDidChange: Event<string>;

  placeholder: string;
  readonly onDidChangePlaceholder: Event<string>;

  validateInput: IInputValidator;
  readonly onDidChangeValidateInput: Event<void>;

  visible: boolean;
  readonly onDidChangeVisibility: Event<boolean>;
}

export interface ISCMRepository extends IDisposable {
  readonly onDidFocus: Event<void>;
  readonly selected: boolean;
  readonly onDidChangeSelection: Event<boolean>;
  readonly provider: ISCMProvider;
  readonly input: ISCMInput;
  focus(): void;
  setSelected(selected: boolean): void;
}

export interface ISCMService {

  readonly _serviceBrand: any;
  readonly onDidAddRepository: Event<ISCMRepository>;
  readonly onDidRemoveRepository: Event<ISCMRepository>;

  readonly repositories: ISCMRepository[];
  readonly selectedRepositories: ISCMRepository[];
  readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]>;

  registerSCMProvider(provider: ISCMProvider): ISCMRepository;
}
