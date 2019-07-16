import { Provider } from '@ali/common-di';
import { MenuElectronMainContribution } from './menu';
import { UIElectronMainContribution } from './ui';

export const serviceProviders: Provider[] = [
  MenuElectronMainContribution,
  UIElectronMainContribution,
];
