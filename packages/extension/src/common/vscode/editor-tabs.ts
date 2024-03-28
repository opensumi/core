import { Event, IDisposable, UriComponents } from '@opensumi/ide-core-common';
import { EditorGroupColumn } from '@opensumi/ide-editor/lib/common';

import type * as vscode from 'vscode';

// #region vsode 旧版本 proposed tab api
export interface IEditorTab {
  name: string;
  group: number;
  resource: vscode.Uri;
  isActive: boolean;
}

export interface IExtHostEditorTabsLegacyProposed {
  readonly _serviceBrand: undefined;
  tabs: readonly IEditorTab[];
  onDidChangeTabs: Event<void>;
}

export const IExtHostEditorTabs = Symbol('IExtHostEditorTabs');

// #region --- tabs model

export const enum TabInputKind {
  UnknownInput,
  TextInput,
  TextDiffInput,
  TextMergeInput,
  NotebookInput,
  NotebookDiffInput,
  CustomEditorInput,
  WebviewEditorInput,
  TerminalEditorInput,
  InteractiveEditorInput,
}

export const enum TabModelOperationKind {
  TAB_OPEN,
  TAB_CLOSE,
  TAB_UPDATE,
  TAB_MOVE,
}

export interface UnknownInputDto {
  kind: TabInputKind.UnknownInput;
}

export interface TextInputDto {
  kind: TabInputKind.TextInput;
  uri: UriComponents;
}

export interface TextDiffInputDto {
  kind: TabInputKind.TextDiffInput;
  original: UriComponents;
  modified: UriComponents;
}

export interface TextMergeInputDto {
  kind: TabInputKind.TextMergeInput;
  base: UriComponents;
  input1: UriComponents;
  input2: UriComponents;
  result: UriComponents;
}

export interface NotebookInputDto {
  kind: TabInputKind.NotebookInput;
  notebookType: string;
  uri: UriComponents;
}

export interface NotebookDiffInputDto {
  kind: TabInputKind.NotebookDiffInput;
  notebookType: string;
  original: UriComponents;
  modified: UriComponents;
}

export interface CustomInputDto {
  kind: TabInputKind.CustomEditorInput;
  viewType: string;
  uri: UriComponents;
}

export interface WebviewInputDto {
  kind: TabInputKind.WebviewEditorInput;
  viewType: string;
}

export interface InteractiveEditorInputDto {
  kind: TabInputKind.InteractiveEditorInput;
  uri: UriComponents;
  inputBoxUri: UriComponents;
}

export interface TabInputDto {
  kind: TabInputKind.TerminalEditorInput;
}

export type AnyInputDto =
  | UnknownInputDto
  | TextInputDto
  | TextDiffInputDto
  | TextMergeInputDto
  | NotebookInputDto
  | NotebookDiffInputDto
  | CustomInputDto
  | WebviewInputDto
  | InteractiveEditorInputDto
  | TabInputDto;

export interface IMainThreadEditorTabsShape extends IDisposable {
  $initializeState(): void;
  // manage tabs: move, close, rearrange etc
  $moveTab(tabId: string, index: number, viewColumn: EditorGroupColumn, preserveFocus?: boolean): void;
  $closeTab(tabIds: string[], preserveFocus?: boolean): Promise<boolean>;
  $closeGroup(groupIds: number[], preservceFocus?: boolean): Promise<boolean>;
}

export interface IEditorTabGroupDto {
  isActive: boolean;
  viewColumn: EditorGroupColumn;
  // Decided not to go with simple index here due to opening and closing causing index shifts
  // This allows us to patch the model without having to do full rebuilds
  tabs: IEditorTabDto[];
  groupId: number;
}

export interface TabOperation {
  readonly kind:
    | TabModelOperationKind.TAB_OPEN
    | TabModelOperationKind.TAB_CLOSE
    | TabModelOperationKind.TAB_UPDATE
    | TabModelOperationKind.TAB_MOVE;
  // TODO @lramos15 Possibly get rid of index for tab update, it's only needed for open and close
  readonly index: number;
  readonly tabDto: IEditorTabDto;
  readonly groupId: number;
  readonly oldIndex?: number;
}

export interface IEditorTabDto {
  id: string;
  label: string;
  input: AnyInputDto;
  editorId?: string;
  isActive: boolean;
  isPinned: boolean;
  isPreview: boolean;
  isDirty: boolean;
}

export interface IExtHostEditorTabsShape {
  // Accepts a whole new model
  $acceptEditorTabModel(tabGroups: IEditorTabGroupDto[]): void;
  // Only when group property changes (not the tabs inside)
  $acceptTabGroupUpdate(groupDto: IEditorTabGroupDto): void;
  // When a tab is added, removed, or updated
  $acceptTabOperation(operation: TabOperation): void;
}

export interface IExtHostEditorTabs extends IExtHostEditorTabsLegacyProposed, IExtHostEditorTabsShape {}

// #endregion
