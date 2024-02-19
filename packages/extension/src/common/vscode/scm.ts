import { CancellationToken } from '@opensumi/vscode-jsonrpc/lib/common/cancellation';

import { IExtensionDescription } from './extension';
import { VSCommand } from './model.api';

import type { IDisposable, Uri, UriComponents } from '@opensumi/ide-core-common';
import type vscode from 'vscode';

export interface ObjectIdentifier {
  $ident?: number;
}

export namespace ObjectIdentifier {
  export const name = '$ident';

  export function mixin<T>(obj: T, id: number): T & ObjectIdentifier {
    Object.defineProperty(obj, name, { value: id, enumerable: true });
    return obj as T & ObjectIdentifier;
  }

  export function of(obj: any): number {
    return obj[name];
  }
}

export type CommandDto = ObjectIdentifier & VSCommand;

export interface SCMProviderFeatures {
  hasHistoryProvider?: boolean;
  hasQuickDiffProvider?: boolean;
  count?: number;
  commitTemplate?: string;
  acceptInputCommand?: VSCommand;
  actionButton?: SCMActionButtonDto | null;
  statusBarCommands?: CommandDto[];
}

export interface SCMActionButtonDto {
  command: CommandDto;
  secondaryCommands?: CommandDto[][];
  description?: string;
  enabled: boolean;
}

export interface SCMHistoryItemGroupDto {
  readonly id: string;
  readonly label: string;
  readonly upstream?: SCMRemoteHistoryItemGroupDto;
}

export interface SCMRemoteHistoryItemGroupDto {
  readonly id: string;
  readonly label: string;
}

export interface SCMHistoryItemDto {
  readonly id: string;
  readonly parentIds: string[];
  readonly label: string;
  readonly description?: string;
  readonly icon?: UriComponents | { light: UriComponents; dark: UriComponents } | vscode.ThemeIcon;
  readonly timestamp?: number;
}

export interface SCMHistoryItemChangeDto {
  readonly uri: UriComponents;
  readonly originalUri: UriComponents | undefined;
  readonly modifiedUri: UriComponents | undefined;
  readonly renameUri: UriComponents | undefined;
}

export interface SCMActionButtonDto {
  command: CommandDto;
  secondaryCommands?: CommandDto[][];
  description?: string;
  enabled: boolean;
}

export interface SCMGroupFeatures {
  hideWhenEmpty?: boolean;
}

export type SCMRawResource = [
  number /* handle*/,
  UriComponents /* resourceUri*/,
  string[] /* icons: light, dark*/,
  string /* tooltip*/,
  boolean /* strike through*/,
  boolean /* faded*/,

  string /* context value*/,
  CommandDto | undefined /* command*/,
];

export interface SCMInputActionButtonDto {
	command: CommandDto;
	icon?: UriComponents | { light: UriComponents; dark: UriComponents } | vscode.ThemeIcon;
	enabled: boolean;
}

export type SCMRawResourceSplice = [number /* start */, number /* delete count */, SCMRawResource[]];

export type SCMRawResourceSplices = [number /* handle*/, SCMRawResourceSplice[]];

export interface IExtHostSCMShape {
  $provideOriginalResource(
    sourceControlHandle: number,
    uri: UriComponents,
    token: CancellationToken,
  ): Promise<UriComponents | null>;
  $onInputBoxValueChange(sourceControlHandle: number, value: string): void;
  $executeResourceCommand(
    sourceControlHandle: number,
    groupHandle: number,
    handle: number,
    preserveFocus: boolean,
  ): Promise<void>;
  $validateInput(
    sourceControlHandle: number,
    value: string,
    cursorPosition: number,
  ): Promise<[string, number] | undefined>;
  $setSelectedSourceControls(selectedSourceControlHandles: number[]): Promise<void>;
  createSourceControl(
    extension: IExtensionDescription,
    id: string,
    label: string,
    rootUri: Uri | undefined,
  ): vscode.SourceControl;
  getSourceControl(extensionId: string, id: string): vscode.SourceControl[] | undefined;
  $provideHistoryItems(
    sourceControlHandle: number,
    historyItemGroupId: string,
    options: any,
    token: CancellationToken,
  ): Promise<SCMHistoryItemDto[] | undefined>;
  $provideHistoryItemChanges(
    sourceControlHandle: number,
    historyItemId: string,
    token: CancellationToken,
  ): Promise<SCMHistoryItemChangeDto[] | undefined>;
  $resolveHistoryItemGroupBase(
    sourceControlHandle: number,
    historyItemGroupId: string,
    token: CancellationToken,
  ): Promise<SCMHistoryItemGroupDto | undefined>;
  $resolveHistoryItemGroupCommonAncestor(
    sourceControlHandle: number,
    historyItemGroupId1: string,
    historyItemGroupId2: string,
    token: CancellationToken,
  ): Promise<{ id: string; ahead: number; behind: number } | undefined>;
}

export interface IMainThreadSCMShape extends IDisposable {
  $registerSourceControl(handle: number, id: string, label: string, rootUri: UriComponents | undefined): void;
  $updateSourceControl(handle: number, features: SCMProviderFeatures): void;
  $unregisterSourceControl(handle: number): void;

  $registerGroup(sourceControlHandle: number, handle: number, id: string, label: string): void;
  $updateGroup(sourceControlHandle: number, handle: number, features: SCMGroupFeatures): void;
  $updateGroupLabel(sourceControlHandle: number, handle: number, label: string): void;
  $unregisterGroup(sourceControlHandle: number, handle: number): void;

  $spliceResourceStates(sourceControlHandle: number, splices: SCMRawResourceSplices[]): void;

  $setInputBoxValue(sourceControlHandle: number, value: string): void;
  $setInputBoxPlaceholder(sourceControlHandle: number, placeholder: string): void;
  $setInputBoxEnablement(sourceControlHandle: number, enabled: boolean): void;
  $setInputBoxVisibility(sourceControlHandle: number, visible: boolean): void;
  $setValidationProviderIsEnabled(sourceControlHandle: number, enabled: boolean): void;

  $onDidChangeHistoryProviderActionButton(sourceControlHandle: number, actionButton?: SCMActionButtonDto | null): void;
  $onDidChangeHistoryProviderCurrentHistoryItemGroup(
    sourceControlHandle: number,
    historyItemGroup: SCMHistoryItemGroupDto | undefined,
  ): void;

  $setInputBoxActionButton(sourceControlHandle: number, actionButton?: SCMInputActionButtonDto | null): void;
}
