import { Injectable, Provider } from '@opensumi/di';
import { BrowserModule, createContributionProvider } from '@opensumi/ide-core-browser';

import { AllowedExtensionsContribution } from '../common';

import { WorkspaceTrustCommandContribution } from './workspace-trust-command.contribution';
import { WorkspaceTrustSettingsContribution } from './workspace-trust-settings.contribution';
import { WorkspaceTrustStatusBarContribution } from './workspace-trust-statusbar.contribution';
import { WorkspaceTrustContribution } from './workspace-trust.contribution';
import { WorkspaceTrustService } from './workspace-trust.service';

@Injectable()
export class WorkspaceTrustModule extends BrowserModule {
  contributionProvider = [AllowedExtensionsContribution];
  providers: Provider[] = [
    WorkspaceTrustService,
    WorkspaceTrustContribution,
    WorkspaceTrustStatusBarContribution,
    WorkspaceTrustCommandContribution,
    WorkspaceTrustSettingsContribution,
  ];
}

export { WorkspaceTrustService } from './workspace-trust.service';
export { WorkspaceTrustContribution } from './workspace-trust.contribution';
export { WorkspaceTrustStatusBarContribution } from './workspace-trust-statusbar.contribution';
export {
  WorkspaceTrustCommandContribution,
  WORKSPACE_TRUST_EXIT_RESTRICTED_COMMAND,
} from './workspace-trust-command.contribution';
export { WorkspaceTrustSettingsContribution } from './workspace-trust-settings.contribution';
export {
  WorkspaceTrustState,
  DEFAULT_ALLOWED_EXTENSION_IDS,
  AllowedExtensionsContribution,
  IAllowedExtensionsContribution,
} from '../common';
