import { IInputBaseProps } from '@opensumi/ide-components';
import { Command, Event, IDisposable, ISequence, Uri } from '@opensumi/ide-core-common';

import type vscode from 'vscode';

export interface VSCommand {
  id: string;
  title: string;
  tooltip?: string;
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

export interface ISCMInputActionButtonDescriptor {
  command: Command;
  icon?: Uri | { light: Uri; dark: Uri } | vscode.ThemeIcon;
  enabled: boolean;
}

export interface ISCMInput {
  value: string;
  readonly onDidChange: Event<string>;

  placeholder: string;
  readonly onDidChangePlaceholder: Event<string>;

  validateInput: IInputValidator;
  readonly onDidChangeValidateInput: Event<void>;

  enabled: boolean;
  readonly onDidChangeEnablement: Event<boolean>;

  visible: boolean;
  readonly onDidChangeVisibility: Event<boolean>;

  props: IInputBaseProps;
  readonly onDidChangeProps: Event<IInputBaseProps>;

  actionButton: ISCMInputActionButtonDescriptor | undefined;
  readonly onDidChangeActionButton: Event<void>;

  appendProps(props: IInputBaseProps): void;

  dispose(): void;
}

export interface ISCMRepository extends IDisposable {
  readonly onDidFocus: Event<void>;
  readonly provider: ISCMProvider;
  readonly input: ISCMInput;
  focus(): void;

  readonly selected: boolean;
  setSelected(selected: boolean): void;
  readonly onDidChangeSelection: Event<ISCMRepository>;
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
  readonly contextValue: string | undefined;
  readonly command: VSCommand | undefined;

  open(preserveFocus: boolean): Promise<void>;
  // 句柄参数转换
  toJSON(): { [key: string]: number };
}

export interface ISCMResourceGroup extends ISequence<ISCMResource> {
  readonly provider: ISCMProvider;
  readonly label: string;
  readonly id: string;
  readonly hideWhenEmpty: boolean;
  readonly onDidChange: Event<void>;
  // 句柄参数转换
  toJSON(): { [key: string]: number };
}

export interface ISCMActionButtonDescriptor {
  command: VSCommand;
  secondaryCommands?: VSCommand[][];
  description?: string;
  enabled: boolean;
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
  readonly actionButton?: ISCMActionButtonDescriptor | null;
  readonly statusBarCommands?: VSCommand[];
  readonly onDidChange: Event<void>;

  getOriginalResource(uri: Uri): Promise<Uri | null>;
  // 句柄参数转换
  toJSON(): { [key: string]: number };
}

export abstract class ISCMService {
  readonly onDidAddRepository: Event<ISCMRepository>;
  readonly onDidRemoveRepository: Event<ISCMRepository>;

  readonly repositories: ISCMRepository[];
  readonly selectedRepositories: ISCMRepository[];
  readonly onDidChangeSelectedRepositories: Event<ISCMRepository[]>;

  abstract registerSCMProvider(provider: ISCMProvider): ISCMRepository;
}
