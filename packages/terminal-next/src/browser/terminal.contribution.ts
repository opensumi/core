import { Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';
import { IExtensionMetaData } from '@opensumi/ide-extension/lib/common';
import {
  IExtensionTerminalProfile,
  ITerminalContributions,
  ITerminalContributionService,
  ITerminalProfileContribution,
} from '../common';

function hasValidTerminalIcon(profile: ITerminalProfileContribution): boolean {
  return (
    !profile.icon ||
    typeof profile.icon === 'string' ||
    URI.isUri(profile.icon) ||
    ('light' in profile.icon && 'dark' in profile.icon && URI.isUri(profile.icon.light) && URI.isUri(profile.icon.dark))
  );
}

@Injectable()
export class TerminalContributionService implements ITerminalContributionService {
  private _terminalProfiles = new Map<string, IExtensionTerminalProfile>();
  get terminalProfiles() {
    return Array.from(this._terminalProfiles.values());
  }

  add(extension: IExtensionMetaData, contributions: ITerminalContributions) {
    const profiles =
      contributions?.profiles
        ?.filter((p) => hasValidTerminalIcon(p))
        .map((e) => ({ ...e, extensionIdentifier: extension.extensionId })) || [];
    for (const profile of profiles) {
      this._terminalProfiles.set(profile.id, profile);
    }
  }
}
