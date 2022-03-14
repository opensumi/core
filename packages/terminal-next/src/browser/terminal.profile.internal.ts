/**
 * TerminalProfileService 是管理 terminal profiles 的基础类
 * 但我们要在这个 Service 上做一些封装，比如解析 terminal.type 等来制造一个假的 Profile
 */

import { Injectable, Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import * as path from '@opensumi/ide-core-common/lib/path';
import { OperatingSystem } from '@opensumi/ide-core-common/lib/platform';

import {
  IResolveDefaultProfileOptions,
  ITerminalProfile,
  ITerminalProfileInternalService,
  ITerminalProfileService,
  ITerminalService,
  ITerminalServiceClient,
  ITerminalServicePath,
} from '../common';
import { CodeTerminalSettingPrefix } from '../common/preference';
import { WindowsShellType } from '../common/shell';

const generatedProfileName = 'Generated Profile';

@Injectable()
export class TerminalProfileInternalService implements ITerminalProfileInternalService {
  @Autowired(ITerminalProfileService)
  profileService: ITerminalProfileService;

  @Autowired(ITerminalService)
  terminalService: ITerminalService;

  @Autowired(PreferenceService)
  private preferenceService: PreferenceService;

  @Autowired(ITerminalServicePath)
  protected readonly serviceClientRPC: ITerminalServiceClient;

  private async resolveTerminalTypeProfile(): Promise<ITerminalProfile | undefined> {
    const shellType = this.preferenceService.get<string>('terminal.type');
    if (!shellType || shellType === 'default') {
      // 继续走我们的 resolveDefaultProfile
      return;
    }
    let shellPath = shellType;
    const args: string[] = [];
    const platformKey = await this.terminalService.getCodePlatformKey();
    const terminalOs = await this.terminalService.getOs();
    if (terminalOs === OperatingSystem.Windows) {
      shellPath = (await this.serviceClientRPC.$resolveWindowsShellPath(shellType as WindowsShellType)) ?? shellPath;
    } else {
      shellPath = (await this.serviceClientRPC.$resolveUnixShellPath(shellType)) ?? shellPath;
    }

    const platformSpecificArgs = this.preferenceService.get<string[]>(
      `${CodeTerminalSettingPrefix.ShellArgs}${platformKey}`,
      [],
    );
    args.push(...platformSpecificArgs);

    return {
      profileName: 'terminal.type',
      path: shellPath,
      args,
      icon: undefined,
      isDefault: false,
    };
  }

  async resolveDefaultProfile(options?: IResolveDefaultProfileOptions): Promise<ITerminalProfile | undefined> {
    // 兼容之前的 terminal.type
    const _defaultPorfile = await this.resolveTerminalTypeProfile();
    if (_defaultPorfile) {
      return _defaultPorfile;
    }

    await this.profileService.profilesReady;
    let profile = await this.resolveRealDefaultProfile();
    if (!profile) {
      profile = await this._resolvedFallbackDefaultProfile(options);
    }
    return profile;
  }

  async resolveRealDefaultProfile() {
    await this.profileService.profilesReady;
    const defaultProfileName = this.profileService.getDefaultProfileName();
    if (!defaultProfileName) {
      return undefined;
    }
    return this.profileService.availableProfiles.find((v) => v.profileName === defaultProfileName);
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
