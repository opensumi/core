import { Injectable, Autowired } from '@ali/common-di';
import { IToolbarActionBtnDelegate, IToolbarRegistry, createToolbarActionBtn, CommandService, CommandRegistry, IDisposable, IToolbarActionBtnState, IToolbarActionSelectDelegate, createToolbarActionSelect } from '@ali/ide-core-browser';
import { IToolbarButtonContribution, IToolbarSelectContribution } from './types';
import { IIconService, IconType } from '@ali/ide-theme';
import { EMIT_EXT_HOST_EVENT } from '../../common';

@Injectable()
export class KaitianExtensionToolbarService {

  private btnDelegates = new Map<string, IToolbarActionBtnDelegate>();

  private selectDelegates = new Map<string, IToolbarActionSelectDelegate<any>>();

  private connected = new Set<string>();

  @Autowired(IToolbarRegistry)
  toolbarRegistry: IToolbarRegistry;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  constructor() {
    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.btn.setState',
    }, {
      execute: (id: string, state: string, title?: string) => {
        if (this.btnDelegates.has(id)) {
          this.btnDelegates.get(id)!.setState(state, title);
        }
      },
    });

    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.btn.connectHandle',
    }, {
      execute: (id: string) => {
        if (!this.connected.has(id)) {
          this.doConnectToolbarButtonHandle(id);
          this.connected.add(id);
        }
      },
    });

    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.select.setState',
    }, {
      execute: (id: string, state: string) => {
        if (this.selectDelegates.has(id)) {
          this.selectDelegates.get(id)!.setState(state);
        }
      },
    });

    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.select.setOptions',
    }, {
      execute: (id: string, extensionBasePath: string, options: any) => {
        if (this.selectDelegates.has(id)) {
          options.forEach((o) => {
            if (o.iconPath) {
              o.iconClass = this.iconService.fromIcon(extensionBasePath, o.iconPath, o.iconMaskMode ? IconType.Mask : IconType.Background)!;
            }
          });
          this.selectDelegates.get(id)!.setOptions(options);
        }
      },
    });

    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.select.setSelect',
    }, {
      execute: (id: string, value: any) => {
        if (this.selectDelegates.has(id)) {
          this.selectDelegates.get(id)!.setSelect(value);
        }
      },
    });

    this.commandRegistry.registerCommand({
      id: 'kaitian-extension.toolbar.select.connectHandle',
    }, {
      execute: (id: string) => {
        if (!this.connected.has(id)) {
          this.doConnectToolbarSelectHandle(id);
          this.connected.add(id);
        }
        if (this.selectDelegates.get(id)) {
          return this.selectDelegates.get(id)!.getValue();
        }
      },
    });
  }

  registerToolbarButton(extensionId: string, extensionBasePath: string,  contribution: IToolbarButtonContribution): IDisposable {
    const id = extensionId + '.' + contribution.id;
    const styles: {[key: string]: IToolbarActionBtnState} = {};
    if (contribution.states) {
      Object.keys(contribution.states).forEach((state) => {
        const o = contribution.states![state];
        styles[state] = {
          ...o,
        };
        if (o.iconPath) {
          styles[state].iconClass = this.iconService.fromIcon(extensionBasePath, o.iconPath, o.iconMaskMode ? IconType.Mask : IconType.Background)!;
        }
      });
    }
    return this.toolbarRegistry.registerToolbarAction({
      id,
      preferredPosition: contribution.preferredPosition,
      strictPosition: contribution.strictPosition,
      component: createToolbarActionBtn({
        id,
        title: contribution.title,
        styles,
        defaultState: contribution.defaultState,
        iconClass: this.iconService.fromIcon(extensionBasePath, contribution.iconPath, contribution.iconMaskMode ? IconType.Mask : IconType.Background)!,
        delegate: (delegate) => {
          if (delegate) {
            this.btnDelegates.set(id, delegate);
            if (contribution.command) {
              delegate.onClick(() => {
                this.commandService.executeCommand(contribution.command!);
              });
            }
            if (this.connected.has(id)) {
              this.doConnectToolbarButtonHandle(id);
            }
          }
        },
      }),
    });
  }

  doConnectToolbarButtonHandle(id: string) {
    const delegate = this.btnDelegates.get(id);
    if (delegate) {
      delegate.onClick(() => {
        return this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'kaitian-extension.toolbar.btn.click', id);
      });
      delegate.onChangeState((args) => {
        return this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'kaitian-extension.toolbar.btn.stateChange', id, args);
      });
    }
  }

  registerToolbarSelect<T = any>(extensionId: string, extensionBasePath: string, contribution: IToolbarSelectContribution<T>) {
    const id = extensionId + '.' + contribution.id;
    const options: {iconClass?: string, label?: string, value: T, iconPath?: string, iconMaskMode?: boolean} [] = contribution.options || [];
    options.forEach((o) => {
      if (o.iconPath) {
        o.iconClass = this.iconService.fromIcon(extensionBasePath, o.iconPath, o.iconMaskMode ? IconType.Mask : IconType.Background)!;
      }
    });
    return this.toolbarRegistry.registerToolbarAction({
      id,
      preferredPosition: contribution.preferredPosition,
      strictPosition: contribution.strictPosition,
      component: createToolbarActionSelect<T>({
        styles: contribution.states,
        options,
        defaultState: contribution.defaultState,
        defaultValue: contribution.defaultValue,
        equals: contribution.optionEqualityKey ? (v1, v2) => {
          const key = contribution.optionEqualityKey!;
          if (!v1 || !v2) {
            return v1 === v2;
          } else {
            return v1[key] === v2[key];
          }
        } : undefined,
        delegate: (delegate) => {
          if (delegate) {
            this.selectDelegates.set(id, delegate);
            if (contribution.command) {
              delegate.onSelect((v) => {
                this.commandService.executeCommand(contribution.command!, v);
              });
            }
            if (this.connected.has(id)) {
              this.doConnectToolbarButtonHandle(id);
            }
          }
        },
      }),
    });
  }

  doConnectToolbarSelectHandle(id: string) {
    const delegate = this.selectDelegates.get(id);
    if (delegate) {
      delegate.onSelect((value) => {
        return this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'kaitian-extension.toolbar.select.onSelect', id, value);
      });
      delegate.onChangeState((args) => {
        return this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'kaitian-extension.toolbar.select.stateChange', id, args);
      });
    }
  }

}
