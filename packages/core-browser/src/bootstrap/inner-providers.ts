import { Provider } from '@ali/common-di';
import {  innerProviders as commonProviders } from '@ali/ide-core-common';

// 一些内置抽象实现
export const innerProviders: Provider[] = [
  ...commonProviders,
];
