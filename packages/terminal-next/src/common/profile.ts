import { IDisposable, Event, URI } from '@opensumi/ide-core-common';
import { ITerminalEnvironment, ITerminalProfileProvider } from '..';
import type vscode from 'vscode';

export const ITerminalProfileService = Symbol('ITerminalProfileService');
export interface ITerminalProfileService {
  readonly availableProfiles: ITerminalProfile[];
  // readonly contributedProfiles: IExtensionTerminalProfile[];
  readonly profilesReady: Promise<void>;
  getPlatformKey(): Promise<string>;
  refreshAvailableProfiles(): void;
  getDefaultProfileName(): string | undefined;
  onDidChangeAvailableProfiles: Event<ITerminalProfile[]>;
  // getContributedDefaultProfile(shellLaunchConfig: IShellLaunchConfig): Promise<IExtensionTerminalProfile | undefined>;
  // registerContributedProfile(args: IRegisterContributedProfileArgs): Promise<void>;
  getContributedProfileProvider(extensionIdentifier: string, id: string): ITerminalProfileProvider | undefined;
  registerTerminalProfileProvider(
    extensionIdentifier: string,
    id: string,
    profileProvider: ITerminalProfileProvider,
  ): IDisposable;
}

export interface ITerminalProfile {
  profileName: string;
  path: string;
  isDefault: boolean;
  isAutoDetected?: boolean;
  args?: string | string[] | undefined;
  env?: ITerminalEnvironment;
  overrideName?: boolean;
  color?: string;
  icon?: vscode.ThemeIcon | URI | { light: URI; dark: URI };
}

export interface IBaseUnresolvedTerminalProfile {
  args?: string | string[] | undefined;
  isAutoDetected?: boolean;
  overrideName?: boolean;
  icon?: string | vscode.ThemeIcon | URI | { light: URI; dark: URI };
  color?: string;
  env?: ITerminalEnvironment;
}

export interface ITerminalExecutable extends IBaseUnresolvedTerminalProfile {
  path: string | string[];
}

export const enum ProfileSource {
  GitBash = 'Git Bash',
  Pwsh = 'PowerShell',
}
export interface ITerminalProfileSource extends IBaseUnresolvedTerminalProfile {
  source: ProfileSource;
}

export interface IPotentialTerminalProfile {
  profileName: string;
  paths: string[];
  args?: string[];
  icon?: vscode.ThemeIcon | URI | { light: URI; dark: URI };
}

export type IUnresolvedTerminalProfile = ITerminalExecutable | ITerminalProfileSource | null;
