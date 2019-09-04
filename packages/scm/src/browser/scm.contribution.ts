import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService, PreferenceSchema } from '@ali/ide-core-common';
import {
  KeybindingContribution, KeybindingRegistry, Logger,
  ClientAppContribution, IContextKeyService, PreferenceContribution,
} from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@ali/ide-core-common/lib/menu';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Disposable } from '@ali/ide-core-common/lib/disposable';

import { SCM } from './scm.view';
import { ISCMService, SCMService, scmViewId } from '../common';
import { StatusUpdater, StatusBarController } from './scm-activity';
import { scmPreferenceSchema } from './scm-preference';

export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

export const SCM_CONTEXT_MENU: MenuPath = ['scm-context-menu'];

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, ComponentContribution, PreferenceContribution)
export class SCMContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, ComponentContribution, PreferenceContribution {
  @Autowired()
  protected readonly logger: Logger;

  @Autowired(IContextKeyService)
  protected readonly contextService: IContextKeyService;

  @Autowired(CommandService)
  protected readonly commandService: CommandService;

  @Autowired(SCMService)
  protected readonly scmService: SCMService;

  @Autowired(StatusUpdater)
  protected readonly statusUpdater: StatusUpdater;

  @Autowired(StatusBarController)
  protected readonly statusBarController: StatusBarController;

  private toDispose = new Disposable();

  schema: PreferenceSchema = scmPreferenceSchema;

  onDidUseConfig() {
  }

  onDidStart() {
    this.statusUpdater.start();
    this.toDispose.addDispose(this.statusUpdater);

    this.statusBarController.start();
    this.toDispose.addDispose(this.statusBarController);
  }

  onStop() {
    this.toDispose.dispose();
  }

  registerCommands(commands: CommandRegistry) {
  }

  registerMenus(menus: MenuModelRegistry) {
  }

  registerKeybindings(keybindings: KeybindingRegistry) {
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-scm', {
      component: SCM,
      id: scmViewId,
      name: 'GIT',
    }, {
      iconClass: 'volans_icon git_icon',
      title: 'SOURCE CONTROL: GIT',
      weight: 8,
      containerId: 'scm',
      activateKeyBinding: 'ctrl+shift+g',
    });
  }
}
