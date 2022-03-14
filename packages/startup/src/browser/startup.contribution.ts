/* eslint-disable no-console */
import { Autowired } from '@opensumi/di';
import {
  KeybindingContribution,
  KeybindingRegistry,
  Logger,
  ClientAppContribution,
  IToolbarRegistry,
  ToolBarActionContribution,
  createToolbarActionBtn,
  createToolbarActionSelect,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { MenuContribution, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IStatusBarService } from '@opensumi/ide-core-browser/lib/services';
import { CommandContribution, CommandRegistry, IEventBus, CommandService } from '@opensumi/ide-core-common';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { BrowserEditorContribution, EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { OutputService } from '@opensumi/ide-output/lib/browser/output.service';
import { ISCMProvider } from '@opensumi/ide-scm';

import { ExampleEditorBottomWidget } from './editor-bottom-example';
import { ExamplePopover } from './exmaple-popover';

@Domain(
  ClientAppContribution,
  CommandContribution,
  KeybindingContribution,
  ComponentContribution,
  ToolBarActionContribution,
  MenuContribution,
  BrowserEditorContribution,
)
export class StartupContribution
  implements
    CommandContribution,
    KeybindingContribution,
    ClientAppContribution,
    ComponentContribution,
    ToolBarActionContribution,
    MenuContribution,
    BrowserEditorContribution
{
  @Autowired(IEventBus)
  eventBus: IEventBus;

  @Autowired(IStatusBarService)
  statusBar: IStatusBarService;

  @Autowired(OutputService)
  outputService: OutputService;

  @Autowired()
  logger: Logger;

  @Autowired(IToolbarRegistry)
  toolbarRegistry: IToolbarRegistry;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  onStart() {}

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorSideWidget({
      id: 'example-bottom',
      component: ExampleEditorBottomWidget,
      displaysOnResource: (r) => r.uri.scheme === 'file',
    });
  }

  registerComponent(registry: ComponentRegistry) {}

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      {
        id: 'gitCommitAndPush',
      },
      {
        execute: async (provider: ISCMProvider, commitMsg: string) => {
          // 强依赖了 git 插件的命令
          const mergeChanges = provider.groups.elements.filter((n) => n.id === 'merge');
          if (mergeChanges.length > 0) {
            // console.log('有冲突尚未解决，请先解决');
            return;
          }
          await this.commandService.executeCommand('git.stageAll', provider);
          await this.commandService.executeCommand('git.commit', provider);
          await this.commandService.executeCommand('git.push', provider);
        },
      },
    );
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {}

  registerToolbarActions(registry: IToolbarRegistry) {
    registry.addLocation('menu-left');
    registry.registerToolbarActionGroup({
      id: 'test-compact',
      compact: true,
      preferredLocation: 'menu-right',
    });
    for (let i = 0; i < 6; i++) {
      registry.registerToolbarAction({
        id: 'test-' + i,
        description: 'test-' + i + '按钮',
        component: createToolbarActionBtn({
          id: 'test-' + i,
          title: 'test-' + i,
          iconClass: getIcon('open'),
          defaultStyle: {
            btnStyle: i > 3 ? 'button' : 'inline',
            background: i > 4 ? 'red' : undefined,
          },
          popoverComponent: ExamplePopover,
          popoverStyle: {
            noContainerStyle: i % 2 === 0,
          },
          delegate: (d) => {
            d?.onClick(() => {
              console.log('test ' + i + ' clicked');
              d.showPopOver({
                horizontalOffset: i * 10,
              });
            });
          },
        }),
        neverCollapse: i > 4,
        preferredPosition: {
          location: 'menu-right',
          group: i === 1 || i === 2 || i === 3 ? 'test-compact' : undefined,
        },
      });
    }
    for (let i = 7; i < 10; i++) {
      registry.registerToolbarAction({
        id: 'test-' + i,
        description: 'test-' + i + '按钮',
        component: createToolbarActionBtn({
          id: 'test-' + i,
          title: 'test-' + i,
          iconClass: getIcon('open'),
          defaultStyle: {
            btnStyle: i > 3 ? 'button' : 'inline',
          },
          delegate: (d) => {
            d?.onClick(() => {
              console.log('test ' + i + ' clicked');
            });
          },
        }),
        preferredPosition: {
          location: 'menu-left',
        },
      });
    }
    registry.registerToolbarAction({
      id: 'test-select-1',
      description: '选项框1',
      weight: 11,
      component: createToolbarActionSelect({
        name: 'test-1',
        delegate: (d) => {
          d?.onSelect((value) => {
            console.log('value ' + value + ' selected');
          });
        },
        options: [
          {
            label: '选项a',
            value: 'a',
          },
          {
            label: '选项b',
            value: 'b',
          },
          {
            label: '选项c',
            value: 'c',
          },
        ],
        defaultValue: 'b',
      }),
    });
    registry.registerToolbarAction({
      id: 'test-select-2',
      weight: 11,
      description: '选项框2',
      component: createToolbarActionSelect({
        name: 'test-2',
        delegate: (d) => {
          d?.onSelect((value) => {
            console.log('value ' + value + ' selected');
          });
        },
        options: [
          {
            groupName: 'TestGroup1',
            options: [
              {
                label: '选项a',
                value: 'a',
              },
              {
                label: '选项b',
                value: 'b',
              },
              {
                label: '选项c',
                value: 'c',
              },
            ],
          },
          {
            iconClass: getIcon('open'),
            groupName: 'TestGroup2',
            options: [
              {
                label: '选项aa',
                value: 'ab',
                iconClass: getIcon('open'),
              },
              {
                label: '选项bb',
                value: 'bb',
                iconClass: getIcon('open'),
              },
              {
                label: '选项cc',
                value: 'cc',
                iconClass: getIcon('open'),
              },
            ],
          },
        ],
        defaultValue: 'cc',
      }),
    });
  }

  registerMenus(menuRegistry: IMenuRegistry) {
    menuRegistry.registerMenuItem(MenuId.SCMInput, {
      command: {
        id: 'gitCommitAndPush',
        label: '提交并推送',
      },
      group: 'navigation',
      type: 'primary',
    });

    menuRegistry.registerMenuItem(MenuId.SCMInput, {
      command: {
        id: 'editor.action.quickCommand',
        label: '打开 quick open',
      },
      group: 'navigation',
      type: 'primary',
    });
  }
}
