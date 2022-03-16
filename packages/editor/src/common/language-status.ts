import {
  IAccessibilityInformation,
  IDisposable,
  Severity,
  Event,
  StatusBarHoverCommand,
} from '@opensumi/ide-core-common';
// eslint-disable-next-line import/no-restricted-paths
import type { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';

import { LanguageSelector } from './language';

export const ILanguageStatusService = Symbol('ILanguageStatusService');
export interface ILanguageStatusService {
  onDidChange: Event<void>;

  addStatus(status: ILanguageStatus): IDisposable;

  getLanguageStatus(model: ITextModel): ILanguageStatus[];
}

export interface ILanguageStatus {
  readonly id: string;
  readonly name: string;
  readonly selector: LanguageSelector;
  readonly severity: Severity;
  readonly label: string;
  readonly detail: string;
  readonly source: string;
  readonly command?: StatusBarHoverCommand;
  readonly accessibilityInfo: IAccessibilityInformation | undefined;
}
