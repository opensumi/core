import { Injectable, Autowired } from '@opensumi/di';
import {
  IToolbarActionBtnDelegate,
  IToolbarRegistry,
  createToolbarActionBtn,
  CommandService,
  CommandRegistry,
  IDisposable,
  IToolbarActionBtnState,
  IToolbarActionSelectDelegate,
  createToolbarActionSelect,
  IEventBus,
  ExtensionActivateEvent,
  IToolbarPopoverRegistry,
} from '@opensumi/ide-core-browser';
import { Disposable } from '@opensumi/ide-core-browser';
import { IIconService, IconType } from '@opensumi/ide-theme';

import { EMIT_EXT_HOST_EVENT } from '../../common';
import { IMainThreadToolbar } from '../../common/sumi/toolbar';
import { ExtensionLoadingView } from '../components';

import { IToolbarButtonContribution, IToolbarSelectContribution } from './types';

@Injectable()
export class KaitianExtensionToolbarService {
  private btnDelegates = new Map<string, IToolbarActionBtnDelegate>();

  private selectDelegates = new Map<string, IToolbarActionSelectDelegate<any>>();

  private connected = new Set<string>();

  @Autowired(IEventBus)
  protected eventBus: IEventBus;

  @Autowired(IToolbarPopoverRegistry)
  protected readonly toolbarPopover: IToolbarPopoverRegistry;

  @Autowired(IToolbarRegistry)
  toolbarRegistry: IToolbarRegistry;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(CommandRegistry)
  commandRegistry: CommandRegistry;

  constructor() {
    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.btn.setState',
      },
      {
        execute: (id: string, state: string, title?: string) => {
          if (this.btnDelegates.has(id)) {
            this.btnDelegates.get(id)!.setState(state, title);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.btn.setContext',
      },
      {
        execute: (id: string, context: string) => {
          if (this.btnDelegates.has(id)) {
            const delegate = this.btnDelegates.get(id);
            if (delegate) {
              delegate.setContext(context);
            }
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.btn.connectHandle',
      },
      {
        execute: (id: string) => {
          if (!this.connected.has(id)) {
            this.doConnectToolbarButtonHandle(id);
            this.connected.add(id);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.select.setState',
      },
      {
        execute: (id: string, state: string) => {
          if (this.selectDelegates.has(id)) {
            this.selectDelegates.get(id)!.setState(state);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.select.setOptions',
      },
      {
        execute: (id: string, extensionBasePath: string, options: any) => {
          if (this.selectDelegates.has(id)) {
            options.forEach((o) => {
              if (o.iconPath) {
                o.iconClass = this.iconService.fromIcon(
                  extensionBasePath,
                  o.iconPath,
                  o.iconMaskMode ? IconType.Mask : IconType.Background,
                )!;
              }
            });
            this.selectDelegates.get(id)!.setOptions(options);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.select.setSelect',
      },
      {
        execute: (id: string, value: any) => {
          if (this.selectDelegates.has(id)) {
            this.selectDelegates.get(id)!.setSelect(value);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.select.connectHandle',
      },
      {
        execute: (id: string) => {
          if (!this.connected.has(id)) {
            this.doConnectToolbarSelectHandle(id);
            this.connected.add(id);
          }
          if (this.selectDelegates.get(id)) {
            return this.selectDelegates.get(id)!.getValue();
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.showPopover',
      },
      {
        execute: (id: string, style) => {
          if (this.btnDelegates.has(id)) {
            this.btnDelegates.get(id)!.showPopOver(style);
          }
        },
      },
    );

    this.commandRegistry.registerCommand(
      {
        id: 'sumi-extension.toolbar.hidePopover',
      },
      {
        execute: (id: string) => {
          if (this.btnDelegates.has(id)) {
            this.btnDelegates.get(id)!.hidePopOver();
          }
        },
      },
    );
  }

  getPopoverComponent(id: string, contribution: IToolbarButtonContribution): React.FC {
    const PlaceHolderComponent = () =>
      ExtensionLoadingView({
        style: {
          minHeight: contribution.popoverStyle?.minHeight ? Number(contribution.popoverStyle?.minHeight) : 200,
          minWidth: contribution.popoverStyle?.minWidth ? Number(contribution.popoverStyle?.minWidth) : 300,
        },
      });
    return this.toolbarPopover.getComponent(id) || PlaceHolderComponent;
  }

  registerToolbarButton(
    extensionId: string,
    extensionBasePath: string,
    contribution: IToolbarButtonContribution,
  ): IDisposable {
    const id = extensionId + '.' + contribution.id;
    const styles: { [key: string]: IToolbarActionBtnState } = {};
    if (contribution.states) {
      Object.keys(contribution.states).forEach((state) => {
        const o = contribution.states![state];
        styles[state] = {
          ...o,
        };
        if (o.iconPath) {
          styles[state].iconClass = this.iconService.fromIcon(
            extensionBasePath,
            o.iconPath,
            o.iconMaskMode ? IconType.Mask : IconType.Background,
          )!;
        }
      });
    }

    return this.toolbarRegistry.registerToolbarAction({
      id,
      preferredPosition: contribution.preferredPosition,
      strictPosition: contribution.strictPosition,
      description: contribution.description || contribution.title || id,
      weight: contribution.weight,
      component: createToolbarActionBtn({
        id,
        popoverId: `${extensionId}:${contribution.popoverComponent}`,
        title: contribution.title,
        styles,
        defaultState: contribution.defaultState,
        iconClass: this.iconService.fromIcon(
          extensionBasePath,
          contribution.iconPath,
          contribution.iconMaskMode ? IconType.Mask : IconType.Background,
        )!,
        // 这里放一个 LoadingView 用于占位，因为 contributes 执行时插件还没有激活完成
        popoverComponent: contribution.popoverComponent
          ? this.getPopoverComponent(`${extensionId}:${contribution.popoverComponent}`, contribution)
          : undefined,
        popoverStyle: contribution.popoverStyle || {
          noContainerStyle: false,
        },
        delegate: (delegate) => {
          if (delegate) {
            this.btnDelegates.set(id, delegate);
            if (contribution.command) {
              delegate.onClick(async () => {
                delegate.showPopOver();
                await this.eventBus.fireAndAwait(
                  new ExtensionActivateEvent({ topic: 'onAction', data: contribution.id }),
                );
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
      delegate.onClick(() =>
        this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'sumi-extension.toolbar.btn.click', id),
      );
      delegate.onChangeState((args) =>
        this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'sumi-extension.toolbar.btn.stateChange', id, args),
      );
    }
  }

  registerToolbarSelect<T = any>(
    extensionId: string,
    extensionBasePath: string,
    contribution: IToolbarSelectContribution<T>,
  ) {
    const id = extensionId + '.' + contribution.id;
    const options: { iconClass?: string; label?: string; value: T; iconPath?: string; iconMaskMode?: boolean }[] =
      contribution.options || [];
    options.forEach((o) => {
      if (o.iconPath) {
        o.iconClass = this.iconService.fromIcon(
          extensionBasePath,
          o.iconPath,
          o.iconMaskMode ? IconType.Mask : IconType.Background,
        )!;
      }
    });
    return this.toolbarRegistry.registerToolbarAction({
      id,
      preferredPosition: contribution.preferredPosition,
      strictPosition: contribution.strictPosition,
      description: contribution.description,
      component: createToolbarActionSelect<T>({
        styles: contribution.states,
        options,
        defaultState: contribution.defaultState,
        defaultValue: contribution.defaultValue,
        equals: contribution.optionEqualityKey
          ? (v1, v2) => {
              const key = contribution.optionEqualityKey!;
              if (!v1 || !v2) {
                return v1 === v2;
              } else {
                return v1[key] === v2[key];
              }
            }
          : undefined,
        delegate: (delegate) => {
          if (delegate) {
            this.selectDelegates.set(id, delegate);
            if (contribution.command) {
              delegate.onSelect((v) => {
                this.commandService.executeCommand(contribution.command!, v);
              });
            }
            if (this.connected.has(id)) {
              this.doConnectToolbarSelectHandle(id);
            }
          }
        },
      }),
    });
  }

  doConnectToolbarSelectHandle(id: string) {
    const delegate = this.selectDelegates.get(id);
    if (delegate) {
      delegate.onSelect((value) =>
        this.commandService.executeCommand(EMIT_EXT_HOST_EVENT.id, 'sumi-extension.toolbar.select.onSelect', id, value),
      );
      delegate.onChangeState((args) =>
        this.commandService.executeCommand(
          EMIT_EXT_HOST_EVENT.id,
          'sumi-extension.toolbar.select.stateChange',
          id,
          args,
        ),
      );
    }
  }
}

// 与 KaitianExtensionToolbarService 区分一下，只是为了给插件进程调用注册 actions
@Injectable({ multiple: true })
export class MainThreadToolbar extends Disposable implements IMainThreadToolbar {
  @Autowired(KaitianExtensionToolbarService)
  toolbarService: KaitianExtensionToolbarService;

  $registerToolbarButtonAction(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarButtonContribution,
  ): Promise<void> {
    this.addDispose(this.toolbarService.registerToolbarButton(extensionId, extensionPath, contribution));
    return Promise.resolve();
  }

  $registerToolbarSelectAction<T = any>(
    extensionId: string,
    extensionPath: string,
    contribution: IToolbarSelectContribution<T>,
  ): Promise<void> {
    this.addDispose(this.toolbarService.registerToolbarSelect(extensionId, extensionPath, contribution));
    return Promise.resolve();
  }
}
