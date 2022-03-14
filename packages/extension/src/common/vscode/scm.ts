import type { IDisposable, UriComponents, IThemeColor } from '@opensumi/ide-core-common';
import { CancellationToken } from '@opensumi/vscode-jsonrpc/lib/common/cancellation';

import { VSCommand } from './model.api';

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
  hasQuickDiffProvider?: boolean;
  count?: number;
  commitTemplate?: string;
  acceptInputCommand?: VSCommand;
  statusBarCommands?: CommandDto[];
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

  // @deprecated use FileDecoration
  string | undefined /* source*/,
  string | undefined /* letter*/,
  IThemeColor | null /* color*/,
];

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
  $setInputBoxVisibility(sourceControlHandle: number, visible: boolean): void;
  $setValidationProviderIsEnabled(sourceControlHandle: number, enabled: boolean): void;
}
