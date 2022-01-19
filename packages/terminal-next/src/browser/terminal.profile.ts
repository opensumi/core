import {
  Disposable,
  Emitter,
  WithEventBus,
  IDisposable,
  Event,
  throttle,
  equals,
  ILogger,
  AutoOpenBarrier,
} from '@opensumi/ide-core-common';
import {
  IResolveDefaultProfileOptions,
  ITerminalProfile,
  ITerminalProfileProvider,
  ITerminalProfileService,
  ITerminalService,
  terminalProfileArgsMatch,
} from '../common';
import { Injectable, Autowired } from '@opensumi/di';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';
import * as path from '@opensumi/ide-core-common/lib/path';
import { CodeTerminalSettingPrefix } from '../common/preference';
import { PreferenceService } from '@opensumi/ide-core-browser';

const generatedProfileName = 'Generated Profile';

@Injectable()
export class TerminalProfileService extends WithEventBus implements ITerminalProfileService {
  private _availableProfiles: ITerminalProfile[] | undefined;

  @Autowired(ITerminalService)
  private terminalService: ITerminalService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

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

  protected async _refreshAvailableProfilesNow(): Promise<void> {
    const profiles = await this._detectProfiles(true);
    const profilesChanged = !equals(profiles, this._availableProfiles, profilesEqual);
    if (profilesChanged) {
      this._availableProfiles = profiles;
      this._profilesReadyBarrier.open();
      this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
    }
  }

  async resolveDefaultProfile(options?: IResolveDefaultProfileOptions): Promise<ITerminalProfile | undefined> {
    await this.profilesReady;
    let profile = await this.resolveRealDefaultProfile();
    if (!profile) {
      profile = await this._resolvedFallbackDefaultProfile(options);
    }
    return profile;
  }

  async resolveRealDefaultProfile() {
    await this.profilesReady;
    const defaultProfileName = this.getDefaultProfileName();
    if (!defaultProfileName) {
      return undefined;
    }
    return this.availableProfiles.find((v) => v.profileName === defaultProfileName);
  }

  private async _resolvedFallbackDefaultProfile(options?: IResolveDefaultProfileOptions): Promise<ITerminalProfile> {
    const executable = await this.terminalService.getDefaultSystemShell();
    // Finally fallback to a generated profile
    let args: string | string[] | undefined;
    const os = options?.os ?? (await this.terminalService.getOs());
    if (os === OperatingSystem.Macintosh && path.parse(executable).name.match(/(zsh|bash)/)) {
      // macOS should launch a login shell by default
      args = ['--login'];
    } else {
      // Resolve undefined to []
      args = [];
    }

    return {
      profileName: generatedProfileName,
      path: executable,
      args,
      isDefault: false,
    };
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
