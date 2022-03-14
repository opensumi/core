import type vscode from 'vscode';

import { DebugConfigurationProviderTriggerKind } from '../../worker/worker.ext-types';

export interface IDebugConfigurationProvider extends vscode.DebugConfigurationProvider {
  readonly type: string;
  readonly triggerKind: DebugConfigurationProviderTriggerKind;
}
