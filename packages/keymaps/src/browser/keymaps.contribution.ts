import { Autowired, Injectable } from '@opensumi/di';
import {
  ClientAppContribution,
  URI,
  Domain,
  CommandContribution,
  CommandRegistry,
  Command,
  COMMON_COMMANDS,
  KeybindingContribution,
  KeybindingRegistry,
  WithEventBus,
  MaybePromise,
  localize,
  getIcon,
  KeyboardNativeLayoutService,
  KEYBOARD_COMMANDS,
  getKeyboardLayoutId,
  KeymapInfo,
  formatLocalize,
} from '@opensumi/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { ResourceService, IResourceProvider, IResource } from '@opensumi/ide-editor';
import { BrowserEditorContribution, EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service/lib/common';
import { QuickPickItem, QuickPickService } from '@opensumi/ide-quick-open';

import { KEYMAPS_SCHEME, IKeymapService } from '../common';

import { KeymapsView } from './keymaps.view';


const KEYMAPS_PREVIEW_COMPONENT_ID = 'keymaps-preview';

@Injectable()
export class KeymapsResourceProvider extends WithEventBus implements IResourceProvider {
  readonly scheme: string = KEYMAPS_SCHEME;

  constructor() {
    super();
  }

  provideResource(uri: URI): MaybePromise<IResource<any>> {
    return {
      name: localize('keymaps.tab.name'),
      icon: getIcon('setting'),
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

export namespace KeymapsContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const KEYMAPS = '2_keymaps';
}

export namespace KEYMAP_COMMANDS {
  const CATEGORY = 'keymaps';

  export const OPEN_SOURCE_FILE: Command = {
    id: 'keymaps.open.source',
    label: localize('keymaps.editorTitle.openSource'),
    category: CATEGORY,
  };
}

@Domain(CommandContribution, KeybindingContribution, ClientAppContribution, BrowserEditorContribution, MenuContribution)
export class KeymapsContribution
  implements
    CommandContribution,
    KeybindingContribution,
    ClientAppContribution,
    BrowserEditorContribution,
    MenuContribution
{
  @Autowired(QuickPickService)
  private readonly quickPickService: QuickPickService;

  @Autowired(KeyboardNativeLayoutService)
  private readonly layoutProvider: KeyboardNativeLayoutService;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(KeymapsResourceProvider)
  protected readonly keymapsResourceProvider: KeymapsResourceProvider;

  @Autowired(IKeymapService)
  protected readonly keymapService: IKeymapService;

  registerCommands(commands: CommandRegistry) {
    commands.registerCommand(COMMON_COMMANDS.OPEN_KEYMAPS, {
      isEnabled: () => true,
      execute: async () => {
        await this.keymapService.open();
      },
    });
    commands.registerCommand(KEYMAP_COMMANDS.OPEN_SOURCE_FILE, {
      execute: async () => {
        this.keymapService.openResource();
      },
    });
    commands.registerCommand(KEYBOARD_COMMANDS.CHOOSE_KEYBOARD_LAYOUT, {
      execute: () => {
        this.chooseLayout();
      },
    });
  }

  registerMenus(menus: IMenuRegistry) {
    menus.registerMenuItem(MenuId.SettingsIconMenu, {
      command: COMMON_COMMANDS.OPEN_KEYMAPS.id,
      group: KeymapsContextMenu.KEYMAPS,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: KEYMAP_COMMANDS.OPEN_SOURCE_FILE.id,
      iconClass: getIcon('open'),
      group: 'navigation',
      order: 4,
      when: `resourceScheme == ${KEYMAPS_SCHEME}`,
    });

    menus.registerMenuItem(MenuId.EditorTitle, {
      command: COMMON_COMMANDS.OPEN_KEYMAPS.id,
      iconClass: getIcon('open'),
      group: 'navigation',
      order: 4,
      when: 'resourceFilename =~ /keymaps.json/',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: COMMON_COMMANDS.OPEN_KEYMAPS.id,
      keybinding: 'ctrlcmd+K ctrlcmd+S',
    });
  }

  onStart() {
    this.keymapService.init();
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.keymapsResourceProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    editorComponentRegistry.registerEditorComponent({
      component: KeymapsView,
      uid: KEYMAPS_PREVIEW_COMPONENT_ID,
      scheme: KEYMAPS_SCHEME,
    });

    editorComponentRegistry.registerEditorComponentResolver(KEYMAPS_SCHEME, (_, __, resolve) => {
      resolve!([
        {
          type: 'component',
          componentId: KEYMAPS_PREVIEW_COMPONENT_ID,
        },
      ]);
    });
  }

  protected async chooseLayout() {
    const current = this.layoutProvider.currentLayoutData;
    const autodetect: QuickPickItem<'autodetect'> = {
      label: localize('keyboard.autoDetect.label'),
      description:
        current && this.layoutProvider.currentLayoutSource !== 'user-choice'
          ? formatLocalize('keyboard.autoDetect.description', getKeyboardLayoutId(current.layout))
          : undefined,
      detail: localize('keyboard.autoDetect.detail'),
      value: 'autodetect',
    };
    const otherLayouts = this.layoutProvider.allLayoutData.map((layout) =>
      this.toQuickPickValue(layout, current === layout),
    );

    let layouts: QuickPickItem<KeymapInfo | 'autodetect'>[];
    layouts = [autodetect, ...otherLayouts];
    const chosen = await this.quickPickService.show(layouts, { placeholder: 'Choose a keyboard layout' });
    if (chosen) {
      return this.layoutProvider.setLayoutData(chosen);
    }
  }

  protected toQuickPickValue(layout: KeymapInfo, isCurrent: boolean): QuickPickItem<KeymapInfo> {
    return {
      label: getKeyboardLayoutId(layout.layout),
      value: layout,
    };
  }
}
