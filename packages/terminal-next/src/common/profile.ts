import { IDisposable, Event } from '@opensumi/ide-core-common/lib';
import { ITerminalProfile, ITerminalProfileProvider } from '..';

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
