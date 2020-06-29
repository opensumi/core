
import { Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, IEventBus } from '@ali/ide-core-common';
import { KeybindingContribution, KeybindingRegistry, Logger, ClientAppContribution, IToolbarRegistry, ToolBarActionContribution, createToolbarActionBtn, createToolbarActionSelect } from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
// import { StatusBar, StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';
import { IStatusBarService} from '@ali/ide-core-browser/lib/services';
import { OutputService } from '@ali/ide-output/lib/browser/output.service';
import { getIcon } from '@ali/ide-core-browser';

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, ComponentContribution, ToolBarActionContribution)
export class StartupContribution implements CommandContribution, KeybindingContribution, ClientAppContribution, ComponentContribution, ToolBarActionContribution {

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

  onStart() {

  }

  registerComponent(registry: ComponentRegistry) {
  }

  registerCommands(commands: CommandRegistry): void {
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
  }

  registerToolbarActions(registry: IToolbarRegistry) {
    registry.addLocation('menu-left');
    for (let i = 0; i < 6; i ++ ) {
      registry.registerToolbarAction({
        id: 'test-' + i,
        component: createToolbarActionBtn({
          id: 'test-' + i,
          title: 'test-' + i,
          iconClass: getIcon('open'),
          defaultStyle: {
            btnStyle: i > 3 ? 'button' : 'inline',
            background: i > 4 ? 'red' : undefined,
          },
          delegate: ((d) => {
            d?.onClick(() => {
              console.log('test ' + i + ' clicked');
            });
          }),
        }),
        neverCollapse: i > 4,
      });
    }
    for (let i = 7; i < 10; i ++ ) {
      registry.registerToolbarAction({
        id: 'test-' + i,
        component: createToolbarActionBtn({
          id: 'test-' + i,
          title: 'test-' + i,
          iconClass: getIcon('open'),
          defaultStyle: {
            btnStyle: i > 3 ? 'button' : 'inline',
          },
          delegate: ((d) => {
            d?.onClick(() => {
              console.log('test ' + i + ' clicked');
            });
          }),
        }),
        preferredPosition: {
          location: 'menu-left',
        },
      });
    }
    registry.registerToolbarAction({
      id: 'test-select-1',
      weight: 11,
      component: createToolbarActionSelect({
        name: 'test-1',
        delegate: ((d) => {
          d?.onSelect((value) => {
            console.log('value ' + value + ' selected');
          });
        }),
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
      component: createToolbarActionSelect({
        name: 'test-2',
        delegate: ((d) => {
          d?.onSelect((value) => {
            console.log('value ' + value + ' selected');
          });
        }),
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
}
