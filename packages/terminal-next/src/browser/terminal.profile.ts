import { Disposable, Emitter, WithEventBus, IDisposable, Event, throttle, equals } from '@opensumi/ide-core-common';
import {
  ITerminalProfile,
  ITerminalProfileProvider,
  ITerminalProfileService,
  ITerminalService,
  terminalProfileArgsMatch,
} from '../common';
import { Injectable, Autowired } from '@opensumi/di';

@Injectable()
export class TerminalProfileService extends WithEventBus implements ITerminalProfileService {
  private _availableProfiles: ITerminalProfile[] | undefined;

  @Autowired(ITerminalService)
  private terminalService: ITerminalService;

  profilesReady: Promise<void>;
  private readonly _onDidChangeAvailableProfiles = new Emitter<ITerminalProfile[]>();
  get onDidChangeAvailableProfiles(): Event<ITerminalProfile[]> {
    return this._onDidChangeAvailableProfiles.event;
  }

  constructor() {
    super();
    this.refreshAvailableProfiles();
  }

  private readonly _profileProviders: Map</* ext id*/ string, Map</* provider id*/ string, ITerminalProfileProvider>> =
    new Map();

  get availableProfiles(): ITerminalProfile[] {
    return this._availableProfiles || [];
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
      this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
    }
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
