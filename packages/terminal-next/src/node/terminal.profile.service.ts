/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// some code copied and modified from https://github.com/microsoft/vscode/blob/ff383268424b1d4b6620e7ea197fb13ae513414f/src/vs/platform/terminal/node/terminalProfiles.ts

import { basename, URI } from '@opensumi/ide-core-common';
import { isWindows } from '@opensumi/ide-core-common/lib/platform';
import { IVariableResolverService } from '@opensumi/ide-variable/lib/common';

import type vscode from 'vscode';

import { Injectable, Autowired } from '@opensumi/di';
import {
  IPotentialTerminalProfile,
  ITerminalProfile,
  IUnresolvedTerminalProfile,
  ProfileSource,
} from '../common/profile';
import { exists, findExecutable, getPowershellPaths, WINDOWS_GIT_BASH_PATHS } from './shell';
import { INodeLogger } from '@opensumi/ide-core-node';
import { ITerminalEnvironment } from '..';
import { readFile } from 'fs-extra';

function applyConfigProfilesToMap(
  configProfiles: { [key: string]: IUnresolvedTerminalProfile } | undefined,
  profilesMap: Map<string, IUnresolvedTerminalProfile>,
) {
  if (!configProfiles) {
    return;
  }
  for (const [profileName, value] of Object.entries(configProfiles)) {
    if (value === null || (!('path' in value) && !('source' in value))) {
      profilesMap.delete(profileName);
    } else {
      value.icon = value.icon || profilesMap.get(profileName)?.icon;
      profilesMap.set(profileName, value);
    }
  }
}

interface DetectProfileOptions {
  // 自动检测可用的 profile
  autoDetect: boolean;
}

export const ITerminalProfileServiceNode = Symbol('ITerminalProfileServiceNode');

@Injectable()
export class TerminalProfileServiceNode {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  @Autowired(IVariableResolverService)
  private variableResolver: IVariableResolverService;

  profileSources: Map<string, IPotentialTerminalProfile> | undefined;

  constructor() {}
  detectAvailableProfiles(options: DetectProfileOptions) {
    if (isWindows) {
      return this._detectWindowsProfiles(options);
    }
    return this._detectUnixProfiles(options);
  }
  // TODO: 从 preference 中加载用户设置的 profile
  _getPreferenceProfiles() {
    const profiles = {} as { [key: string]: IUnresolvedTerminalProfile };
    return profiles;
  }
  async _detectWindowsProfiles(options: DetectProfileOptions) {
    const defaultProfileName = 'windowsDefault';
    const configProfiles = this._getPreferenceProfiles();
    const { autoDetect } = options;

    // Determine the correct System32 path. We want to point to Sysnative
    // when the 32-bit version of VS Code is running on a 64-bit machine.
    // The reason for this is because PowerShell's important PSReadline
    // module doesn't work if this is not the case. See #27915.
    const is32ProcessOn64Windows = process.env.hasOwnProperty('PROCESSOR_ARCHITEW6432');
    const system32Path = `${process.env['windir']}\\${is32ProcessOn64Windows ? 'Sysnative' : 'System32'}`;

    await this.initializeWindowsProfiles();

    const detectedProfiles: Map<string, IUnresolvedTerminalProfile> = new Map();

    // Add auto detected profiles
    if (autoDetect) {
      detectedProfiles.set('PowerShell', {
        source: ProfileSource.Pwsh,
        // icon: Codicon.terminalPowershell,
        isAutoDetected: true,
      });
      detectedProfiles.set('Windows PowerShell', {
        path: `${system32Path}\\WindowsPowerShell\\v1.0\\powershell.exe`,
        // icon: Codicon.terminalPowershell,
        isAutoDetected: true,
      });
      detectedProfiles.set('Git Bash', {
        source: ProfileSource.GitBash,
        isAutoDetected: true,
      });
      detectedProfiles.set('Cygwin', {
        path: [
          `${process.env['HOMEDRIVE']}\\cygwin64\\bin\\bash.exe`,
          `${process.env['HOMEDRIVE']}\\cygwin\\bin\\bash.exe`,
        ],
        args: ['--login'],
        isAutoDetected: true,
      });
      detectedProfiles.set('Command Prompt', {
        path: `${system32Path}\\cmd.exe`,
        // icon: Codicon.terminalCmd,
        isAutoDetected: true,
      });
    }

    applyConfigProfilesToMap(configProfiles, detectedProfiles);
    const resultProfiles = this.transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName);
    // TODO: 暂不引入 WSL 的相关逻辑
    // const useWslProfiles = ;
    // let useWSLexe = false;
    // if (getWindowsBuildNumber() >= 16299) {
    //   useWSLexe = true;
    // }
    // if (autoDetect || (!autoDetect && useWslProfiles)) {
    //   const wslPath = `${system32Path}\\${useWSLexe ? 'wsl' : 'bash'}.exe`;
    // }
    return resultProfiles;
  }
  async initializeWindowsProfiles() {
    if (this.profileSources) {
      return;
    }
    this.profileSources = new Map();

    this.profileSources = new Map();
    this.profileSources.set('Git Bash', {
      profileName: 'Git Bash',
      paths: WINDOWS_GIT_BASH_PATHS,
      args: ['--login'],
    });

    this.profileSources.set('PowerShell', {
      profileName: 'PowerShell',
      paths: await getPowershellPaths(),
      // icon: ThemeIcon.asThemeIcon(Codicon.terminalPowershell),
    });
  }
  async _detectUnixProfiles(options: DetectProfileOptions) {
    const defaultProfileName = 'unixDefault';
    const { autoDetect } = options;
    const configProfiles = this._getPreferenceProfiles();

    const detectedProfiles: Map<string, IUnresolvedTerminalProfile> = new Map();
    if (autoDetect) {
      const contents = (await readFile('/etc/shells')).toString();
      const profiles = contents.split('\n').filter((e) => e.trim().indexOf('#') !== 0 && e.trim().length > 0);
      const counts: Map<string, number> = new Map();
      for (const profile of profiles) {
        let profileName = basename(profile);
        let count = counts.get(profileName) || 0;
        count++;
        if (count > 1) {
          profileName = `${profileName} (${count})`;
        }
        counts.set(profileName, count);
        detectedProfiles.set(profileName, { path: profile, isAutoDetected: true });
      }
    }
    applyConfigProfilesToMap(configProfiles, detectedProfiles);
    return await this.transformToTerminalProfiles(detectedProfiles.entries(), defaultProfileName);
  }

  async validateProfilePaths(
    profileName: string,
    defaultProfileName: string | undefined,
    potentialPaths: string[],
    args: string[] | string | undefined,
    env: ITerminalEnvironment,
    overrideName?: boolean | undefined,
    isAutoDetected?: boolean | undefined,
  ) {
    if (potentialPaths.length === 0) {
      return Promise.resolve(undefined);
    }

    const path = potentialPaths.shift() as string;
    if (path === '') {
      // 如果是空的，则跳过
      return this.validateProfilePaths(
        profileName,
        defaultProfileName,
        potentialPaths,
        args,
        env,
        overrideName,
        isAutoDetected,
      );
    }

    const profile: ITerminalProfile = {
      profileName,
      path,
      args,
      env,
      overrideName,
      isAutoDetected,
      isDefault: profileName === defaultProfileName,
    };

    // For non-absolute paths, check if it's available on $PATH
    if (basename(path) === path) {
      // The executable isn't an absolute path, try find it on the PATH
      const executable = await findExecutable(path, undefined, undefined, undefined);
      if (!executable) {
        return this.validateProfilePaths(
          profileName,
          defaultProfileName,
          potentialPaths,
          args,
          env,
          overrideName,
          isAutoDetected,
        );
      }
      return profile;
    }

    const result = await exists(path);
    if (result) {
      return profile;
    }

    return this.validateProfilePaths(
      profileName,
      defaultProfileName,
      potentialPaths,
      args,
      env,
      overrideName,
      isAutoDetected,
    );
  }

  async transformToTerminalProfiles(
    entries: IterableIterator<[string, IUnresolvedTerminalProfile]>,
    defaultProfileName: string | undefined,
  ): Promise<ITerminalProfile[]> {
    const resultProfiles: ITerminalProfile[] = [];
    for (const [profileName, profile] of entries) {
      if (profile === null) {
        continue;
      }
      let originalPaths: string[] = [];
      let args: string[] | string | undefined;
      let icon: vscode.ThemeIcon | URI | { light: URI; dark: URI } | undefined;
      if ('source' in profile) {
        const source = this.profileSources?.get(profile.source);
        if (!source) {
          continue;
        }
        originalPaths = source.paths;

        // if there are configured args, override the default ones
        args = profile.args || source.args;
        if (profile.icon) {
          // icon = validateIcon(profile.icon);
        } else if (source.icon) {
          icon = source.icon;
        }
      } else {
        originalPaths = Array.isArray(profile.path) ? profile.path : [profile.path];
        args = isWindows ? profile.args : Array.isArray(profile.args) ? profile.args : undefined;
        // icon = validateIcon(profile.icon);
      }

      // TODO: use  (await this.variableResolver.resolveArray(originalPaths))
      const paths = originalPaths.slice();
      const validatedProfile = await this.validateProfilePaths(profileName, defaultProfileName, paths, args, {});
      if (validatedProfile) {
        validatedProfile.isAutoDetected = profile.isAutoDetected;
        validatedProfile.icon = icon;
        validatedProfile.color = profile.color;
        resultProfiles.push(validatedProfile);
      } else {
        this.logger.log('profile not validated', profileName, originalPaths);
      }
    }
    return resultProfiles;
  }
}
