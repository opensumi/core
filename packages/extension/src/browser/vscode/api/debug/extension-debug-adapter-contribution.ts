import { DebuggerDescription, DebugConfiguration } from '@ide-framework/ide-debug';
import { MaybePromise, IJSONSchema, IJSONSchemaSnippet } from '@ide-framework/ide-core-browser';
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
    return this.extDebug.$getSchemaAttributes(this.type);
  }

  async getConfigurationSnippets(): Promise<IJSONSchemaSnippet[]> {
    return this.extDebug.$getConfigurationSnippets(this.type);
  }

  async provideDebugConfigurations(workspaceFolderUri: string | undefined): Promise<DebugConfiguration[]> {
    return this.extDebug.$provideDebugConfigurations(this.type, workspaceFolderUri);
  }

  async resolveDebugConfiguration(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration | undefined> {
    return this.extDebug.$resolveDebugConfigurations(config, workspaceFolderUri);
  }

  async resolveDebugConfigurationWithSubstitutedVariables(config: DebugConfiguration, workspaceFolderUri: string | undefined): Promise<DebugConfiguration | undefined> {
    return this.extDebug.$resolveDebugConfigurationWithSubstitutedVariables(config, workspaceFolderUri);
  }

  async createDebugSession(config: DebugConfiguration): Promise<string> {
    await this.activationEventService.fireEvent('onDebugAdapterProtocolTracker', config.type);
    return this.extDebug.$createDebugSession(config);
  }

  async terminateDebugSession(sessionId: string): Promise<void> {
    this.extDebug.$terminateDebugSession(sessionId);
  }
}
