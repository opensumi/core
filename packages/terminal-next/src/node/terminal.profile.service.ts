/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// some code copied and modified from https://github.com/microsoft/vscode/blob/ff383268424b1d4b6620e7ea197fb13ae513414f/src/vs/platform/terminal/node/terminalProfiles.ts

import { URI } from '@opensumi/ide-core-common';
import { isWindows } from '@opensumi/ide-core-common/lib/platform';

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
import { IDetectProfileOptions, ITerminalEnvironment } from '..';
import { readFile } from 'fs-extra';
import * as path from '@opensumi/ide-core-common/lib/path';

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

export const ITerminalProfileServiceNode = Symbol('ITerminalProfileServiceNode');

@Injectable()
export class TerminalProfileServiceNode {
  @Autowired(INodeLogger)
  private logger: INodeLogger;

  profileSources: Map<string, IPotentialTerminalProfile> | undefined;
  private _perferenceProfiles: { [key: string]: IUnresolvedTerminalProfile };

  constructor() {}
  detectAvailableProfiles(options: IDetectProfileOptions) {
    if (options.preference) {
      // 说明用户有设置 perference 中的 profile
      // 目前 Node 端无法获取 browser 层的配置，所以需要前端传进来
      this._perferenceProfiles = options.preference;
    }

    if (isWindows) {
      return this._detectWindowsProfiles(options);
    }
    return this._detectUnixProfiles(options);
  }
  _getPreferenceProfiles(): { [key: string]: IUnresolvedTerminalProfile } {
    return this._perferenceProfiles || {};
  }
  async _detectWindowsProfiles(options: IDetectProfileOptions) {
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
  async _detectUnixProfiles(options: IDetectProfileOptions) {
    const defaultProfileName = 'unixDefault';
    const { autoDetect } = options;
    const configProfiles = this._getPreferenceProfiles();

    const detectedProfiles: Map<string, IUnresolvedTerminalProfile> = new Map();
    if (autoDetect) {
      const contents = (await readFile('/etc/shells')).toString();
      const profiles = contents.split('\n').filter((e) => e.trim().indexOf('#') !== 0 && e.trim().length > 0);
      const counts: Map<string, number> = new Map();
      for (const profile of profiles) {
        let profileName = path.basename(profile);
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

    const potentialPath = potentialPaths.shift() as string;
    if (potentialPath === '') {
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
      path: potentialPath,
      args,
      env,
      overrideName,
      isAutoDetected,
      isDefault: profileName === defaultProfileName,
    };

    // For non-absolute paths, check if it's available on $PATH
    if (path.basename(potentialPath) === potentialPath) {
      // The executable isn't an absolute path, try find it on the PATH
      const executable = await findExecutable(potentialPath, undefined, undefined, undefined);
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

    const result = await exists(potentialPath);
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
