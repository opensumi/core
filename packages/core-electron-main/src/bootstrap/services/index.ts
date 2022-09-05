import { Provider } from '@opensumi/di';

import { MenuElectronMainContribution } from './menu';
import { ProtocolElectronMainContribution } from './protocol';
import { UIElectronMainContribution } from './ui';
import { UrlElectronMainContribution } from './url';

export { ElectronClipboardService, INativeClipboardService } from './clipboard';
export const serviceProviders: Provider[] = [
  MenuElectronMainContribution,
  UIElectronMainContribution,
  ProtocolElectronMainContribution,
  UrlElectronMainContribution,
];
