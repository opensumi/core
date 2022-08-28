import { Provider } from '@opensumi/di';

import { ElectronClipboardService, IClipboardService } from './clipboard';
import { MenuElectronMainContribution } from './menu';
import { ProtocolElectronMainContribution } from './protocol';
import { UIElectronMainContribution } from './ui';
import { UrlElectronMainContribution } from './url';

export const serviceProviders: Provider[] = [
  MenuElectronMainContribution,
  UIElectronMainContribution,
  ProtocolElectronMainContribution,
  UrlElectronMainContribution,
  {
    token: IClipboardService,
    useClass: ElectronClipboardService,
  },
];
