import { Provider } from '@ali/common-di';
import { MenuElectronMainContribution } from './menu';
import { UIElectronMainContribution } from './ui';
import { ProtocolElectronMainContribution } from './protocol';

export const serviceProviders: Provider[] = [
  MenuElectronMainContribution,
  UIElectronMainContribution,
  ProtocolElectronMainContribution,
];
