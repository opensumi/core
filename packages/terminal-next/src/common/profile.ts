import { Event, IDisposable, OperatingSystem, URI } from '@opensumi/ide-core-common';

import {
  ICreateContributedTerminalProfileOptions,
  IShellLaunchConfig,
  ITerminalEnvironment,
  ITerminalProfileProvider,
  TerminalIcon,
} from '..';

import type vscode from 'vscode';

export interface IResolveDefaultProfileOptions {
  os?: OperatingSystem;
}

export const ITerminalProfileService = Symbol('ITerminalProfileService');
export interface ITerminalProfileService {
  readonly availableProfiles: ITerminalProfile[];
  readonly contributedProfiles: IExtensionTerminalProfile[];
  readonly profilesReady: Promise<void>;
  onTerminalProfileResolved: Event<string>;
  onDidChangeAvailableProfiles: Event<ITerminalProfile[]>;
  onDidChangeDefaultShell: Event<string>;
  getDefaultProfileName(): string | undefined;
  getContributedDefaultProfile(shellLaunchConfig: IShellLaunchConfig): Promise<IExtensionTerminalProfile | undefined>;
  getContributedProfileProvider(extensionIdentifier: string, id: string): ITerminalProfileProvider | undefined;
  refreshAvailableProfiles(): void;
  registerTerminalProfileProvider(
    extensionIdentifier: string,
    id: string,
    profileProvider: ITerminalProfileProvider,
  ): IDisposable;
  createContributedTerminalProfile(
    extensionIdentifier: string,
    id: string,
    options: ICreateContributedTerminalProfileOptions,
  ): Promise<void>;
  addContributedProfile(extensionId: string, contributions: ITerminalContributions): void;
  removeContributedProfile(extensionId: string): void;
}

export const ITerminalProfileInternalService = Symbol('ITerminalProfileInternalService');
export interface ITerminalProfileInternalService {
  resolveDefaultProfile(options?: IResolveDefaultProfileOptions): Promise<ITerminalProfile | undefined>;
  resolveRealDefaultProfile(): Promise<ITerminalProfile | undefined>;
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
  icon?: TerminalIcon;
}

export interface IBaseUnresolvedTerminalProfile {
  args?: string | string[] | undefined;
  isAutoDetected?: boolean;
  overrideName?: boolean;
  icon?: string | TerminalIcon;
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

export function terminalProfileArgsMatch(
  args1: string | string[] | undefined,
  args2: string | string[] | undefined,
): boolean {
  if (!args1 && !args2) {
    return true;
  } else if (typeof args1 === 'string' && typeof args2 === 'string') {
    return args1 === args2;
  } else if (Array.isArray(args1) && Array.isArray(args2)) {
    if (args1.length !== args2.length) {
      return false;
    }
    for (let i = 0; i < args1.length; i++) {
      if (args1[i] !== args2[i]) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export interface IDetectProfileOptionsPreference {
  [key: string]: IUnresolvedTerminalProfile;
}

export interface IDetectProfileOptions {
  // 自动检测可用的 profile
  autoDetect: boolean;
  preference?: IDetectProfileOptionsPreference;
}

export interface ITerminalContributions {
  profiles?: ITerminalProfileContribution[];
}

export interface ITerminalProfileContribution {
  title: string;
  id: string;
  icon?: URI | { light: URI; dark: URI } | string;
  color?: string;
}

export interface IExtensionTerminalProfile extends ITerminalProfileContribution {
  extensionIdentifier: string;
}

export type ITerminalProfileObject = ITerminalExecutable | ITerminalProfileSource | IExtensionTerminalProfile | null;
export type ITerminalProfileType = ITerminalProfile | IExtensionTerminalProfile;

export interface ISaveContributedProfileArgs {
  extensionIdentifier: string;
  id: string;
  title: string;
  options: ICreateContributedTerminalProfileOptions;
}
