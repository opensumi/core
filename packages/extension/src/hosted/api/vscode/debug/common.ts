import { DebugConfigurationProviderTriggerKind } from '../../worker/worker.ext-types';

import type vscode from 'vscode';

export interface IDebugConfigurationProvider extends vscode.DebugConfigurationProvider {
  readonly type: string;
  readonly triggerKind: DebugConfigurationProviderTriggerKind;
}
