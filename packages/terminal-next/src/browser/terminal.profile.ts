import { Disposable, Emitter, isWindows, WithEventBus, IDisposable, Event } from '@opensumi/ide-core-common';
import { isMacintosh } from '@opensumi/ide-core-common/lib/platform';
import { ITerminalProfile, ITerminalProfileProvider } from '../common';
import { ITerminalProfileService } from '../common/profile';

/*
 * Links TerminalService with TerminalProfileResolverService
 * and keeps the available terminal profiles updated
 */
export class TerminalProfileService extends WithEventBus implements ITerminalProfileService {
  private _availableProfiles: ITerminalProfile[] | undefined;

  profilesReady: Promise<void>;
  private readonly _onDidChangeAvailableProfiles = new Emitter<ITerminalProfile[]>();
  get onDidChangeAvailableProfiles(): Event<ITerminalProfile[]> {
    return this._onDidChangeAvailableProfiles.event;
  }

  private readonly _profileProviders: Map</* ext id*/ string, Map</* provider id*/ string, ITerminalProfileProvider>> =
    new Map();

  async getPlatformKey(): Promise<string> {
    // const env = await this._remoteAgentService.getEnvironment();
    // if (env) {
    // 	return env.os === OperatingSystem.Windows ? 'windows' : (env.os === OperatingSystem.Macintosh ? 'osx' : 'linux');
    // }
    return isWindows ? 'windows' : isMacintosh ? 'osx' : 'linux';
  }

  get availableProfiles(): ITerminalProfile[] {
    // if (!this._platformConfigJustRefreshed) {
    // 	this.refreshAvailableProfiles();
    // }
    return this._availableProfiles || [];
  }

  // get contributedProfiles(): IExtensionTerminalProfile[] {
  // 	return this._contributedProfiles || [];
  // }

  refreshAvailableProfiles(): void {
    throw new Error('Method not implemented.');
  }
  getDefaultProfileName(): string | undefined {
    throw new Error('Method not implemented.');
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
  private async _detectProfiles(includeDetectedProfiles?: boolean): Promise<ITerminalProfile[]> {
    // const primaryBackend = this._terminalInstanceService.getBackend(this._environmentService.remoteAuthority);
    // if (!primaryBackend) {
    // 	return this._availableProfiles || [];
    // }
    // const platform = await this.getPlatformKey();
    // this._defaultProfileName = this._configurationService.getValue(`${TerminalSettingPrefix.DefaultProfile}${platform}`) ?? undefined;
    // return primaryBackend.getProfiles(this._configurationService.getValue(`${TerminalSettingPrefix.Profiles}${platform}`), this._defaultProfileName, includeDetectedProfiles);
    return [];
  }

  protected async _refreshAvailableProfilesNow(): Promise<void> {
    const profiles = await this._detectProfiles();
    // if (profiles.length === 0 && this._ifNoProfilesTryAgain) {
    // 	// available profiles get updated when a terminal is created
    // 	// or relevant config changes.
    // 	// if there are no profiles, we want to refresh them again
    // 	// since terminal creation can't happen in this case and users
    // 	// might not think to try changing the config
    // 	this._ifNoProfilesTryAgain = false;
    // 	await this._refreshAvailableProfilesNow();
    // 	return;
    // }
    // const profilesChanged = !(equals(profiles, this._availableProfiles, profilesEqual));
    // const contributedProfilesChanged = await this._updateContributedProfiles();
    // if (profilesChanged || contributedProfilesChanged) {
    // 	this._availableProfiles = profiles;
    // 	this._onDidChangeAvailableProfiles.fire(this._availableProfiles);
    // 	this._profilesReadyBarrier.open();
    // 	this._updateWebContextKey();
    // 	await this._refreshPlatformConfig(this._availableProfiles);
    // }
  }
}
