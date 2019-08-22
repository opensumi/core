import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService } from '@ali/ide-core-common';
import {
  KeybindingContribution, KeybindingRegistry, Logger,
  ClientAppContribution, SCM_COMMANDS, IContextKeyService,
} from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@ali/ide-core-common/lib/menu';
import { LayoutContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Disposable } from '@ali/ide-core-common/lib/disposable';

import { SCM } from './scm.view';
import { ISCMService, SCMService } from '../common';
import { StatusUpdater, StatusBarController } from './scm-activity';

export const SCM_ACCEPT_INPUT: Command = {
  id: 'scm.acceptInput',
};

export const SCM_CONTEXT_MENU: MenuPath = ['scm-context-menu'];

const SCMCtxMenuOpenChanges = [ '1_open_changes'];
const SCMCtxMenuOpenFile = [ '2_open_file'];
const SCMCtxMenuOpenFileHead = [ '3_open_file_head'];
const SCMCtxMenuDiscardChanges = [ '4_discard_changes'];
const SCMCtxMenuStageChanges = [ '5_stage_changes'];
const SCMCtxMenuAdd2Gitignore = [ '6_add_to_gitignore'];

namespace SCMContextMenu {
  // 1_, 2_用于菜单排序，这样能保证分组顺序顺序
  export const PULL = [...SCM_CONTEXT_MENU, '1_pull'];
  export const PULL_REBASE = [...SCM_CONTEXT_MENU, '2_pull_rebase'];
  export const PULL_FROM = [...SCM_CONTEXT_MENU, '3_pull_from'];
  export const PUSH = [...SCM_CONTEXT_MENU, '4_push'];
}

@Domain(ClientAppContribution, CommandContribution, KeybindingContribution, MenuContribution, LayoutContribution)
export class SCMContribution implements CommandContribution, KeybindingContribution, MenuContribution, ClientAppContribution, LayoutContribution {
  private readonly handlerId = 'scm';

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

  onDidStart() {
    this.statusUpdater.start(this.handlerId);
    this.toDispose.addDispose(this.statusUpdater);

    this.statusBarController.start();
    this.toDispose.addDispose(this.statusBarController);
  }

  onStop() {
    this.toDispose.dispose();
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(SCM_ACCEPT_INPUT, {
      execute: async () => {
        const [selectedRepository] = this.scmService.selectedRepositories;
        if (!selectedRepository || !selectedRepository.provider.acceptInputCommand) {
          return;
        }

        const { id: commandId, arguments: args = [] } = selectedRepository.provider.acceptInputCommand;
        if (!commandId) {
          return;
        }

        this.commandService.executeCommand(commandId, ...args);
      },
    });
  }

  registerMenus(menus: MenuModelRegistry): void {
    menus.registerMenuAction(SCMContextMenu.PULL, {
      commandId: 'git.pull',
    });
    menus.registerMenuAction(SCMContextMenu.PUSH, {
      commandId: 'git.push',
    });
  }

  registerKeybindings(keybindings: KeybindingRegistry): void {
    keybindings.registerKeybinding({
      command: SCM_ACCEPT_INPUT.id,
      keybinding: 'ctrlcmd+enter',
      // when: // todo
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-scm', {
      component: SCM,
      id: this.handlerId,
      name: 'GIT',
    }, {
      iconClass: 'volans_icon git_icon',
      title: 'SOURCE CONTROL: GIT',
      weight: 8,
      containerId: 'scm',
    });
  }
}
