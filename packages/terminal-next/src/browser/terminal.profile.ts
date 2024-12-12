import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceChange, PreferenceService } from '@opensumi/ide-core-browser';
import {
  AutoOpenBarrier,
  Disposable,
  Emitter,
  Event,
  IDisposable,
  ILogger,
  PreferenceScope,
  TerminalSettingsId,
  URI,
  WithEventBus,
  arrays,
  throttle,
} from '@opensumi/ide-core-common';

import {
  ICreateContributedTerminalProfileOptions,
  IExtensionTerminalProfile,
  ISaveContributedProfileArgs,
  IShellLaunchConfig,
  ITerminalContributions,
  ITerminalProfile,
  ITerminalProfileContribution,
  ITerminalProfileObject,
  ITerminalProfileProvider,
  ITerminalProfileService,
  ITerminalService,
  terminalProfileArgsMatch,
} from '../common';
import { CodeTerminalSettingPrefix } from '../common/preference';

const { equals } = arrays;

@Injectable()
export class TerminalProfileService extends WithEventBus implements ITerminalProfileService {
  @Autowired(ITerminalService)
  private readonly terminalService: ITerminalService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  private readonly _profilesReadyBarrier: AutoOpenBarrier;

  private onTerminalProfileResolvedEmitter: Emitter<string> = new Emitter();
  private onDidChangeDefaultShellEmitter: Emitter<string> = new Emitter();

  /**
   * 当用户创建了一个 Profile 时发出的事件
   */
  get onTerminalProfileResolved() {
    return this.onTerminalProfileResolvedEmitter.event;
  }

  get onDidChangeDefaultShell() {
    return this.onDidChangeDefaultShellEmitter.event;
  }

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
    this.setupPreferenceListener();
  }

  private readonly _profileProviders: Map</* ext id*/ string, Map</* provider id*/ string, ITerminalProfileProvider>> =
    new Map();

  private _availableProfiles: ITerminalProfile[] | undefined;
  get availableProfiles(): ITerminalProfile[] {
    return this._availableProfiles || [];
  }

  private _contributedProfiles: IExtensionTerminalProfile[] = [];
  get contributedProfiles(): IExtensionTerminalProfile[] {
    return this._contributedProfiles || [];
  }

  private setupPreferenceListener() {
    this.preferenceService.onPreferenceChanged((event: PreferenceChange) => {
      if (event.preferenceName === TerminalSettingsId.Type) {
        /**
         * @todo 因 profile 相关能力未完全实现，因此这里先手动派发一个 change shell 的事件
         * 实现完成后，这里应该调用 this.refreshAvailableProfiles();
         */
        this.onDidChangeDefaultShellEmitter.fire(event.newValue);
      }
    });
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

  async createContributedTerminalProfile(
    extensionIdentifier: string,
    id: string,
    options: ICreateContributedTerminalProfileOptions,
  ): Promise<void> {
    await this.onTerminalProfileResolvedEmitter.fireAndAwait(id);
    const profileProvider = this.getContributedProfileProvider(extensionIdentifier, id);
    if (!profileProvider) {
      this.logger.error(`No terminal profile provider registered for id "${id}"`);
      return;
    }
    try {
      await profileProvider.createContributedTerminalProfile(options);
    } catch (e) {
      this.logger.error('create contributed terminal profile error:', e.message);
    }
  }

  public registerTerminalProfileProvider(
    extensionIdentifier: string,
    id: string,
    profileProvider: ITerminalProfileProvider,
  ): IDisposable {
    let extMap = this._profileProviders.get(extensionIdentifier);
    if (!extMap) {
      extMap = new Map();
      this._profileProviders.set(extensionIdentifier, extMap);
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
      this.rawContributedProfiles.filter((p) => !excludedContributedProfiles.includes(p.title)),
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

  async saveContributedProfile(args: ISaveContributedProfileArgs): Promise<void> {
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

  // #region 外部插件贡献的 Terminal Profiles
  private _rawContributedProfileMap = new Map<string, IExtensionTerminalProfile>();
  get rawContributedProfiles() {
    return Array.from(this._rawContributedProfileMap.values());
  }

  addContributedProfile(extensionId: string, contributions: ITerminalContributions) {
    const profiles =
      contributions?.profiles
        ?.filter((p) => hasValidTerminalIcon(p))
        .map((e) => ({ ...e, extensionIdentifier: extensionId })) || [];
    for (const profile of profiles) {
      this._rawContributedProfileMap.set(profile.id, profile);
    }

    this.refreshAvailableProfiles();
  }

  removeContributedProfile(extensionId: string): void {
    const profiles = this.rawContributedProfiles;
    for (const profile of profiles) {
      if (profile.extensionIdentifier === extensionId) {
        this._rawContributedProfileMap.delete(profile.id);
      }
    }
  }
  // #endregion
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

function hasValidTerminalIcon(profile: ITerminalProfileContribution): boolean {
  return (
    !profile.icon ||
    typeof profile.icon === 'string' ||
    URI.isUri(profile.icon) ||
    ('light' in profile.icon && 'dark' in profile.icon && URI.isUri(profile.icon.light) && URI.isUri(profile.icon.dark))
  );
}
