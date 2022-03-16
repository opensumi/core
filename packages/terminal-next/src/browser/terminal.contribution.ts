import { Injectable } from '@opensumi/di';
import { URI } from '@opensumi/ide-core-common';

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

  add(extensionId: string, contributions: ITerminalContributions) {
    const profiles =
      contributions?.profiles
        ?.filter((p) => hasValidTerminalIcon(p))
        .map((e) => ({ ...e, extensionIdentifier: extensionId })) || [];
    for (const profile of profiles) {
      this._terminalProfiles.set(profile.id, profile);
    }
  }
}
