import { Autowired, INJECTOR_TOKEN, Injectable, Injector, Provider } from '@opensumi/di';
import {
  AppConfig,
  BrowserModule,
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  Domain,
  IClipboardService,
  IElectronMainMenuService,
  IElectronNativeDialogService,
  IEventBus,
  ILogger,
  KeybindingContribution,
  KeybindingRegistry,
  Schemes,
  SlotLocation,
  URI,
  electronEnv,
  formatLocalize,
  isOSX,
  isWindows,
} from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { IMenuRegistry, MenuContribution, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IElectronMenuBarService } from '@opensumi/ide-core-browser/lib/menu/next/renderer/ctxmenu/electron';
import { IElectronMainLifeCycleService, IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { IResourceOpenOptions } from '@opensumi/ide-editor';
import {
  DragOverPosition,
  EditorGroupFileDropEvent,
  getSplitActionFromDragDrop,
} from '@opensumi/ide-editor/lib/browser';
import { IMessageService } from '@opensumi/ide-overlay/lib/common';

import { IElectronHeaderService } from '../common/header';

import { ElectronClipboardService } from './clipboard';
import { ElectronNativeDialogService } from './dialog';
import { ElectronPreferenceContribution } from './electron-preference.contribution';
import { ElectronHeaderService } from './header/header.service';
import { ElectronHeaderBar } from './header/header.view';
import { WelcomeContribution } from './welcome/contribution';

import '../common/i18n/setup';

@Injectable()
export class ElectronBasicModule extends BrowserModule {
  providers: Provider[] = [
    {
      token: IElectronNativeDialogService,
      useClass: ElectronNativeDialogService,
    },
    {
      token: IElectronHeaderService,
      useClass: ElectronHeaderService,
    },
    ElectronBasicContribution,
    ElectronPreferenceContribution,
    WelcomeContribution,
  ];
}

const nativeRoles = [
  {
    name: 'undo',
    key: 'ctrlcmd+z',
    when: '!editorFocus',
  },
  {
    name: 'redo',
    key: 'ctrlcmd+shift+z',
    when: '!editorFocus',
  },
  {
    name: 'copy',
    key: 'ctrlcmd+c',
    when: '!editorFocus',
  },
  {
    name: 'paste',
    key: 'ctrlcmd+v',
    when: '!editorFocus',
  },
  {
    name: 'selectAll',
    key: 'ctrlcmd+a',
    when: '!editorFocus',
  },
  {
    name: 'cut',
    key: 'ctrlcmd+x',
    when: '!editorFocus',
  },
  {
    name: 'toggleDevTools',
    key: 'alt+ctrlcmd+i',
    label: '%window.toggleDevTools%',
  },
];

@Domain(ComponentContribution, ClientAppContribution, MenuContribution, CommandContribution, KeybindingContribution)
export class ElectronBasicContribution
  implements
    KeybindingContribution,
    CommandContribution,
    ComponentContribution,
    ClientAppContribution,
    MenuContribution
{
  @Autowired(AppConfig)
  config: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(IElectronMenuBarService)
  private electronMenuBarService: IElectronMenuBarService;

  @Autowired(IElectronMainMenuService)
  private electronMainMenuService: IElectronMainMenuService;

  @Autowired(IElectronMainLifeCycleService)
  private electronMainLifeCycleService: IElectronMainLifeCycleService;

  @Autowired(IElectronMainUIService)
  private electronMainUIService: IElectronMainUIService;

  @Autowired(IMessageService)
  private messageService: IMessageService;

  @Autowired(ILogger)
  logger: ILogger;

  registerComponent(registry: ComponentRegistry) {
    const top = this.config.layoutConfig[SlotLocation.top];
    if (top && top.modules) {
      const index = top.modules.indexOf('@opensumi/ide-menu-bar');
      if (index !== -1) {
        top.modules.splice(index, 1, 'electron-header');
      }
    }
    registry.register(
      'electron-header',
      {
        id: 'electron-header',
        component: ElectronHeaderBar,
      },
      {
        size: 27,
        containerId: 'electron-header',
      },
    );
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.MenubarAppMenu, {
      command: {
        id: 'electron.about',
        label: '%common.about%',
      },
      group: '0_about',
      nativeRole: 'about',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.toggleDevTools',
        label: '%window.toggleDevTools%',
      },
      nativeRole: 'toggledevtools',
    });

    menuRegistry.registerMenuItem(MenuId.MenubarHelpMenu, {
      command: {
        id: 'electron.reload',
        label: '%window.reload%',
      },
    });

    menuRegistry.registerMenuItem(MenuId.ExplorerContext, {
      command: 'electron.revealInFinder',
      group: '12_electron',
      order: 3,
    });
    menuRegistry.registerMenuItem(MenuId.EditorTitleContext, {
      command: 'electron.revealInFinderTab',
      group: '2_open',
      order: 3,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    nativeRoles.forEach((role) => {
      commands.registerCommand(
        {
          id: 'electron.' + role.name,
          label: role.label,
        },
        {
          execute: () => {
            this.electronMainMenuService.runNativeRoleAction(role.name);
          },
        },
      );
    });

    commands.registerCommand(
      {
        id: 'electron.zoomIn',
        label: '%view.zoomIn%',
      },
      {
        execute: () => {
          this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
            delta: 0.1,
          });
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.zoomOut',
        label: '%view.zoomOut%',
      },
      {
        execute: () => {
          this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
            delta: -0.1,
          });
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.zoomReset',
        label: '%view.zoomReset%',
      },
      {
        execute: () => {
          this.electronMainUIService.setZoomFactor(electronEnv.currentWebContentsId, {
            value: 1,
          });
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.reload',
        label: '%window.reload%',
      },
      {
        execute: () => {
          this.electronMainLifeCycleService.reloadWindow(electronEnv.currentWindowId);
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.revealInFinder',
        label: '%explorer.electron.revealInFinder%',
      },
      {
        execute: (uri: URI) => {
          if (uri && uri.scheme === Schemes.file) {
            this.electronMainUIService.revealInFinder(uri.codeUri.fsPath);
          }
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.revealInFinderTab',
        label: '%explorer.electron.revealInFinder%',
      },
      {
        execute: ({ uri }: { uri?: URI } = {}) => {
          if (uri && uri.scheme === Schemes.file) {
            this.electronMainUIService.revealInFinder(uri.codeUri.fsPath);
          }
        },
      },
    );

    commands.registerCommand(
      {
        id: 'electron.openInSystemTerminal',
        label: '%explorer.electron.openInSystemTerminal%',
      },
      {
        execute: (uri: URI) => {
          if (uri && uri.scheme === Schemes.file) {
            try {
              this.electronMainUIService.revealInSystemTerminal(uri.codeUri.fsPath);
            } catch (e) {
              this.logger.error(e);
              this.messageService.error(
                formatLocalize('explorer.electron.openInSystemTerminal.error', uri.displayName, e.message),
              );
            }
          }
        },
      },
    );
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
    nativeRoles.forEach((role) => {
      if (role.key) {
        keybindings.registerKeybinding({
          command: 'electron.' + role.name,
          keybinding: role.key,
          when: role.when,
          priority: Number.MIN_SAFE_INTEGER, // 永远在最后被命中
        });
      }
    });

    keybindings.registerKeybinding({
      command: 'electron.reload',
      keybinding: 'shift+ctrlcmd+r',
    });

    keybindings.registerKeybinding({
      command: 'electron.zoomIn',
      keybinding: isWindows ? 'alt+=' : 'ctrlcmd+=',
    });

    keybindings.registerKeybinding({
      command: 'electron.zoomOut',
      keybinding: isWindows ? 'alt+-' : 'ctrlcmd+-',
    });
    keybindings.registerKeybinding({
      command: 'electron.zoomReset',
      keybinding: isWindows ? 'alt+numpad0' : 'ctrlcmd+numpad0',
    });
  }

  onStart() {
    if (isOSX) {
      this.electronMenuBarService.start();
    }

    // 注册drag drop file的行为
    this.eventBus.on(EditorGroupFileDropEvent, async (event) => {
      const payload = event.payload;
      // fileList 只能这样遍历
      for (let i = 0; i < payload.files.length; i++) {
        const file = payload.files[i];
        let group = event.payload.group;
        if (file.path) {
          const fileURI = URI.file(file.path);
          const options: IResourceOpenOptions = {
            index: event.payload.tabIndex !== -1 ? event.payload.tabIndex : undefined,
          };
          // 只有第一个才split
          if (i === 0 && event.payload.position && event.payload.position !== DragOverPosition.CENTER) {
            options.split = getSplitActionFromDragDrop(event.payload.position);
          }
          // 只有最后一个才可能为 preview
          if (i < payload.files.length - 1) {
            options.preview = false;
          }
          const res = await group.open(fileURI, options);
          if (res) {
            // split后当前group会变动
            group = res.group;
          }
        }
      }
    });

    // override broswer modules
    this.injector.overrideProviders({
      token: IClipboardService,
      useClass: ElectronClipboardService,
    });
  }
}
