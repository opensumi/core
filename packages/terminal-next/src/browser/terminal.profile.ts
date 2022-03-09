import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  Disposable,
  Emitter,
  WithEventBus,
  IDisposable,
  Event,
  throttle,
  equals,
  AutoOpenBarrier,
  PreferenceScope,
} from '@opensumi/ide-core-common';

import {
  IExtensionTerminalProfile,
  IRegisterContributedProfileArgs,
  IShellLaunchConfig,
  ITerminalContributionService,
  ITerminalProfile,
  ITerminalProfileObject,
  ITerminalProfileProvider,
  ITerminalProfileService,
  ITerminalService,
  terminalProfileArgsMatch,
} from '../common';
import { CodeTerminalSettingPrefix } from '../common/preference';


@Injectable()
export class TerminalProfileService extends WithEventBus implements ITerminalProfileService {
  private _availableProfiles: ITerminalProfile[] | undefined;

  @Autowired(ITerminalService)
  private terminalService: ITerminalService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(ITerminalContributionService)
  terminalContributionService: ITerminalContributionService;

  private _profilesReadyBarrier: AutoOpenBarrier;

  get profilesReady(): Promise<void> {
    return this._profilesReadyBarrier.wait().then(() => {});
  }
  private readonly _onDidChangeAvailableProfiles = new Emitter<ITerminalProfile[]>();
  get onDidChangeAvailableProfiles(): Event<ITerminalProfile[]> {
    return this._onDidChangeAvailableProfiles.event;
  }

  constructor() {
    super();
    // Wait up to 5 seconds for profiles to be ready so it's assured that we know the actual
    // default terminal before launching the first terminal. This isn't expected to ever take
    // this long.
    this._profilesReadyBarrier = new AutoOpenBarrier(5000);
    this.refreshAvailableProfiles();
  }

  private readonly _profileProviders: Map</* ext id*/ string, Map</* provider id*/ string, ITerminalProfileProvider>> =
    new Map();

  get availableProfiles(): ITerminalProfile[] {
    return this._availableProfiles || [];
  }

  private _contributedProfiles: IExtensionTerminalProfile[] = [];
  get contributedProfiles(): IExtensionTerminalProfile[] {
    return this._contributedProfiles || [];
  }

  getDefaultProfileName(): string | undefined {
    return this.preferenceService.get<string>(
      `${CodeTerminalSettingPrefix.DefaultProfile}${this.terminalService.getCodePlatformKey()}`,
    );
  }

  @throttle(2000)
  refreshAvailableProfiles(): void {
    this._refreshAvailableProfilesNow();
  }

  getContributedProfileProvider(extensionIdentifier: string, id: string): ITerminalProfileProvider | undefined {
    const extMap = this._profileProviders.get(extensionIdentifier);
    return extMap?.get(id);
  }

  public registerTerminalProfileProvider(
    extensionIdentifierenfifier: string,
    id: string,
    profileProvider: ITerminalProfileProvider,
  ): IDisposable {
    let extMap = this._profileProviders.get(extensionIdentifierenfifier);
    if (!extMap) {
      extMap = new Map();
      this._profileProviders.set(extensionIdentifierenfifier, extMap);
    }
    extMap.set(id, profileProvider);
    return Disposable.create(() => this._profileProviders.delete(id));
  }

  private async _detectProfiles(autoDetect = true): Promise<ITerminalProfile[]> {
    return await this.terminalService.getProfiles(autoDetect);
  }

  private async _updateContributedProfiles(): Promise<boolean> {
    const platformKey = await this.terminalService.getCodePlatformKey();
    const excludedContributedProfiles: string[] = [];
    const configProfiles: { [key: string]: any } = this.preferenceService.get(
      CodeTerminalSettingPrefix.Profiles + platformKey,
      {},
    );
    for (const [profileName, value] of Object.entries(configProfiles)) {
      if (value === null) {
        excludedContributedProfiles.push(profileName);
      }
    }
    const filteredContributedProfiles = Array.from(
      this.terminalContributionService.terminalProfiles.filter((p) => !excludedContributedProfiles.includes(p.title)),
    );

    const contributedProfilesChanged = !equals(
      filteredContributedProfiles,
      this._contributedProfiles,
      contributedProfilesEqual,
    );
    this._contributedProfiles = filteredContributedProfiles;
    return contributedProfilesChanged;
  }

  protected async _refreshAvailableProfilesNow(): Promise<void> {
    const profiles = await this._detectProfiles(true);
    const profilesChanged = !equals(profiles, this._availableProfiles, profilesEqual);
    const contributedProfilesChanged = await this._updateContributedProfiles();

    if (profilesChanged || contributedProfilesChanged) {
      this._availableProfiles = profiles;
      this._profilesReadyBarrier.open();
      this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
    }
  }

  async getContributedDefaultProfile(
    shellLaunchConfig: IShellLaunchConfig,
  ): Promise<IExtensionTerminalProfile | undefined> {
    // prevents recursion with the MainThreadTerminalService call to create terminal
    // and defers to the provided launch config when an executable is provided
    if (shellLaunchConfig && !shellLaunchConfig.extHostTerminalId && !('executable' in shellLaunchConfig)) {
      const key = await this.terminalService.getCodePlatformKey();
      const defaultProfileName = this.preferenceService.get(`${CodeTerminalSettingPrefix.DefaultProfile}${key}`);
      const contributedDefaultProfile = this.contributedProfiles.find((p) => p.title === defaultProfileName);
      return contributedDefaultProfile;
    }
    return undefined;
  }

  async registerContributedProfile(args: IRegisterContributedProfileArgs): Promise<void> {
    const platformKey = await this.terminalService.getCodePlatformKey();
    const profilesConfig = await this.preferenceService.get(`${CodeTerminalSettingPrefix.Profiles}${platformKey}`);
    if (typeof profilesConfig === 'object') {
      const newProfile: IExtensionTerminalProfile = {
        extensionIdentifier: args.extensionIdentifier,
        icon: args.options.icon,
        id: args.id,
        title: args.title,
        color: args.options.color,
      };

      (profilesConfig as { [key: string]: ITerminalProfileObject })[args.title] = newProfile;
    }
    await this.preferenceService.set(
      `${CodeTerminalSettingPrefix.Profiles}${platformKey}`,
      profilesConfig,
      PreferenceScope.User,
    );
    return;
  }
}

function profilesEqual(one: ITerminalProfile, other: ITerminalProfile) {
  return (
    one.profileName === other.profileName &&
    terminalProfileArgsMatch(one.args, other.args) &&
    one.color === other.color &&
    one.isAutoDetected === other.isAutoDetected &&
    one.isDefault === other.isDefault &&
    one.overrideName === other.overrideName &&
    one.path === other.path
  );
}

function contributedProfilesEqual(one: IExtensionTerminalProfile, other: IExtensionTerminalProfile) {
  return (
    one.extensionIdentifier === other.extensionIdentifier &&
    one.color === other.color &&
    one.icon === other.icon &&
    one.id === other.id &&
    one.title === other.title
  );
}
