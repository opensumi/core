import { DebuggerDescription, DebugConfiguration } from '@opensumi/ide-debug';
import { MaybePromise, IJSONSchema, IJSONSchemaSnippet } from '@opensumi/ide-core-browser';
import { IExtHostDebug } from '../../../../common/vscode';
import { IActivationEventService } from '../../../types';

export class ExtensionDebugAdapterContribution {
  constructor(
    protected readonly description: DebuggerDescription,
    protected readonly extDebug: IExtHostDebug,
    protected readonly activationEventService: IActivationEventService ) { }

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

  async provideDebugConfigurations(workspaceFolderUri: string | undefined): Promise<DebugConfiguration[]> {
    return await this.extDebug.$provideDebugConfigurations(this.type, workspaceFolderUri);
  }

  async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration | undefined | null> {
    return await this.extDebug.$resolveDebugConfigurations(config, workspaceFolderUri);
  }

  async resolveDebugConfigurationWithSubstitutedVariables(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration | undefined | null> {
    return await this.extDebug.$resolveDebugConfigurationWithSubstitutedVariables(config, workspaceFolderUri);
  }

  async createDebugSession(config: DebugConfiguration): Promise<string> {
    await this.activationEventService.fireEvent('onDebugAdapterProtocolTracker', config.type);
    return await this.extDebug.$createDebugSession(config);
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    await this.extDebug.$terminateDebugSession(sessionId);
  }
}
