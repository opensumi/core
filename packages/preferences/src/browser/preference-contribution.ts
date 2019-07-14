import { Autowired } from '@ali/common-di';

import {
  ClientAppContribution,
  InMemoryResourceResolver,
  JsonSchemaStore,
  PreferenceSchemaProvider,
  URI,
  Domain,
  CommandContribution,
  CommandRegistry,
  COMMON_COMMANDS,
  KeybindingContribution,
  KeybindingRegistry,
  PreferenceScope,
  preferenceScopeProviderTokenMap,
} from '@ali/ide-core-browser';
import { MonacoContribution } from '@ali/ide-monaco';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
@Domain(CommandContribution, KeybindingContribution, MonacoContribution, ClientAppContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution, MonacoContribution, ClientAppContribution {

  @Autowired(JsonSchemaStore)
  private readonly jsonSchemaStore: JsonSchemaStore;
  @Autowired(PreferenceSchemaProvider)
  private readonly schemaProvider: PreferenceSchemaProvider;
  @Autowired(InMemoryResourceResolver)
  private readonly inmemoryResources: InMemoryResourceResolver;

  @Autowired(preferenceScopeProviderTokenMap[PreferenceScope.Workspace])
  protected readonly workspacePreferenceProvider: WorkspacePreferenceProvider;

  @Autowired(FileServiceClient)
  protected readonly filesystem: FileServiceClient;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_PREFERENCES, {
      isEnabled: () => true,
      execute: async (preferenceScope = PreferenceScope.User) => {
        await this.openPreferences(preferenceScope);
      },
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_PREFERENCES.id,
      keybinding: 'ctrl+,',
    });
  }

  onMonacoLoaded() {
    require('./preferences-monaco-contribution');
  }

  onStart() {
    const serializeSchema = () => JSON.stringify(this.schemaProvider.getCombinedSchema());
    const uri = new URI('vscode://schemas/settings/user');
    this.inmemoryResources.add(uri, serializeSchema());
    this.jsonSchemaStore.registerSchema({
      fileMatch: ['settings.json', USER_PREFERENCE_URI.toString()],
      url: uri.toString(),
    });
    this.schemaProvider.onDidPreferenceSchemaChanged(() =>
      this.inmemoryResources.update(uri, serializeSchema()),
    );
  }

  protected async openPreferences(preferenceScope: PreferenceScope): Promise<void> {
    const wsUri = this.workspacePreferenceProvider.getConfigUri();
    if (wsUri && !await this.filesystem.exists(wsUri.toString())) {
      await this.filesystem.createFile(wsUri.toString());
    }
  }
}
