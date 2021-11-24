import { Provider } from '@opensumi/common-di';
import { MenuElectronMainContribution } from './menu';
import { UIElectronMainContribution } from './ui';
import { ProtocolElectronMainContribution } from './protocol';
import { UrlElectronMainContribution } from './url';

export const serviceProviders: Provider[] = [
  MenuElectronMainContribution,
  UIElectronMainContribution,
  ProtocolElectronMainContribution,
  UrlElectronMainContribution,
];
