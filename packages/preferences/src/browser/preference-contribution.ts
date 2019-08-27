import { Autowired, Injectable } from '@ali/common-di';

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
  WithEventBus,
  MaybePromise,
} from '@ali/ide-core-browser';
import { MonacoContribution } from '@ali/ide-monaco';
import { USER_PREFERENCE_URI } from './user-preference-provider';
import { WorkspacePreferenceProvider } from './workspace-preference-provider';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { PreferenceService } from '@ali/ide-core-browser/lib/preferences';
import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { ResourceService, IResourceProvider, IResource } from '@ali/ide-editor';
import { PREF_SCHEME } from '../common';
import { PreferenceView } from './preferences.view';

const PREF_PREVIEW_COMPONENT_ID = 'pref-preview';

@Injectable()
export class PrefResourceProvider extends WithEventBus implements IResourceProvider {

  readonly scheme: string = PREF_SCHEME;

  constructor() {
    super();
  }

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    // 获取文件类型 getFileType: (path: string) => string
    return {
      name: 'pref',
      icon: '',
      uri,
    };
  }

  provideResourceSubname(resource: IResource, groupResources: IResource[]): string | null {
    return null;
  }

  async shouldCloseResource(resource: IResource, openedResources: IResource[][]): Promise<boolean> {
    return true;
  }
}

@Domain(CommandContribution, KeybindingContribution, MonacoContribution, ClientAppContribution, BrowserEditorContribution)
export class PreferenceContribution implements CommandContribution, KeybindingContribution, MonacoContribution, ClientAppContribution, BrowserEditorContribution {

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

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(PrefResourceProvider)
  prefResourceProvider: PrefResourceProvider;

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

  // 初始化PreferenceService下的PreferenceProvider，如Folder，Workspace
  initialize(): void {
    this.preferenceService.initializeProviders();
  }

  protected async openPreferences(preferenceScope: PreferenceScope): Promise<void> {
    const wsUri = this.workspacePreferenceProvider.getConfigUri();
    if (wsUri && !await this.filesystem.exists(wsUri.toString())) {
      await this.filesystem.createFile(wsUri.toString());
    }
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.prefResourceProvider);
  }

  registerComponent(editorComponentRegistry: EditorComponentRegistry) {

    editorComponentRegistry.registerEditorComponent({
      component: PreferenceView,
      uid: PREF_PREVIEW_COMPONENT_ID,
      scheme: PREF_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(PREF_SCHEME, (_, __, resolve) => {

      resolve!([
        {
          type: 'component',
          componentId: PREF_PREVIEW_COMPONENT_ID,
        },
      ]);

    });
  }
}
