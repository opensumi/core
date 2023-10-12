import type { Uri } from '@opensumi/ide-core-common';

import type { IExtensionDescription } from '../../common/vscode';

import { UriComponents } from './ext-types';

export interface IStringDetails {
  message: string;
  args?: Record<string | number, any>;
  comment?: string | string[];
}

export interface IMainThreadLocalization {
  $fetchBuiltInBundleUri(id: string, language: string): Promise<Uri | undefined>;
  $fetchBundleContents(uriComponents: UriComponents): Promise<string>;
}

export interface IExtHostLocalization {
  $setCurrentLanguage(language: string): void;

  getMessage(extensionId: string, details: IStringDetails): string;
  getBundle(extensionId: string): { [key: string]: string } | undefined;
  getBundleUri(extensionId: string): Uri | undefined;
  initializeLocalizedMessages(extension: IExtensionDescription): Promise<void>;
}
