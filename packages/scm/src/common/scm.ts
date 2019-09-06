import { Event, IDisposable } from '@ali/ide-core-common';
import { Uri } from '@ali/ide-core-common/lib/uri';
import { ISequence } from '@ali/ide-core-common/lib/sequence';

interface VSCommand {
  id: string;
  title: string;
  tooltip?: string;
  // tslint:disable-next-line:no-any
  arguments?: any[];
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

export interface ISCMResourceDecorations {
  icon?: Uri;
  iconDark?: Uri;
  tooltip?: string;
  strikeThrough?: boolean;
  faded?: boolean;

  source?: string;
  letter?: string;
  color?: string;
}

export interface ISCMResource {
  readonly resourceGroup: ISCMResourceGroup;
  readonly sourceUri: Uri;
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

  readonly rootUri?: Uri;
  readonly count?: number;
  readonly commitTemplate?: string;
  readonly onDidChangeCommitTemplate?: Event<string>;
  readonly onDidChangeStatusBarCommands?: Event<VSCommand[]>;
  readonly acceptInputCommand?: VSCommand;
  readonly statusBarCommands?: VSCommand[];
  readonly onDidChange: Event<void>;

  getOriginalResource(uri: Uri): Promise<Uri | null>;
}

export abstract class ISCMService {
  readonly _serviceBrand: any;
  readonly onDidAddRepository: Event<ISCMRepository>;
  readonly onDidRemoveRepository: Event<ISCMRepository>;

  readonly repositories: ISCMRepository[];
  readonly selectedRepositories: ISCMRepository[];
  readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]>;

  abstract registerSCMProvider(provider: ISCMProvider): ISCMRepository;
}

export const SCMMenuId = {
  SCM_TITLE: 'scm/title',
  SCM_SOURCE_CONTROL: 'scm/sourceControl',
  SCM_RESOURCE_GROUP_CTX: 'scm/resourceGroup/context',
  SCM_RESOURCE_STATE_CTX: 'scm/resourceState/context',
  SCM_CHANGE_TITLE: 'scm/change/title',
};
