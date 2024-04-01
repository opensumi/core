import { MaybePromise, IJSONSchema, IJSONSchemaSnippet, CancellationToken } from '@opensumi/ide-core-browser';
import { DebugConfiguration } from '@opensumi/ide-debug/lib/common/debug-configuration';
import { DebuggerDescription } from '@opensumi/ide-debug/lib/common/debug-service';
import { IDebugSessionDTO } from '@opensumi/ide-debug/lib/common/debug-session-options';

import { IExtHostDebug } from '../../../../common/vscode';
import { DebugConfigurationProviderTriggerKind } from '../../../../common/vscode/ext-types';
import { IActivationEventService } from '../../../types';

export class ExtensionDebugAdapterContribution {
  constructor(
    protected readonly description: DebuggerDescription,
    protected readonly extDebug: IExtHostDebug,
    protected readonly activationEventService: IActivationEventService,
  ) {}

  get type(): string {
    return this.description.type;
  }

  get label(): MaybePromise<string | undefined> {
    return this.description.label;
  }

  get languages(): MaybePromise<string[] | undefined> {
    return this.extDebug.$getSupportedLanguages(this.type);
  }

  async getSchemaAttributes(): Promise<IJSONSchema[]> {
    return await this.extDebug.$getSchemaAttributes(this.type);
  }

  async getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    return await this.extDebug.$getConfigurationSnippets(this.type);
  }

  async provideDebugConfigurations(
    workspaceFolderUri: string | undefined,
    token?: CancellationToken,
    triggerKind?: DebugConfigurationProviderTriggerKind,
  ): Promise<DebugConfiguration[]> {
    return await this.extDebug.$provideDebugConfigurations(this.type, workspaceFolderUri, token, triggerKind);
  }

  async getDebugConfigurationProvidersCount(triggerKind?: DebugConfigurationProviderTriggerKind) {
    return await this.extDebug.$getDebugConfigurationProvidersCount(this.type, triggerKind);
  }

  async resolveDebugConfiguration(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null> {
    return await this.extDebug.$resolveDebugConfigurations(config, workspaceFolderUri);
  }

  async resolveDebugConfigurationWithSubstitutedVariables(
    config: DebugConfiguration,
    workspaceFolderUri: string | undefined,
  ): Promise<DebugConfiguration | undefined | null> {
    return await this.extDebug.$resolveDebugConfigurationWithSubstitutedVariables(config, workspaceFolderUri);
  }

  async createDebugSession(dto: IDebugSessionDTO): Promise<string> {
    const { configuration } = dto;
    await this.activationEventService.fireEvent('onDebugAdapterProtocolTracker', configuration.type);
    return await this.extDebug.$createDebugSession({
      ...dto,
      parentSession: undefined,
      parent: dto.parentSession ? dto.parentSession.id : undefined,
    });
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    await this.extDebug.$terminateDebugSession(sessionId);
  }
}
