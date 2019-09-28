import { Injectable, Autowired } from '@ali/common-di';
import { CommandContribution, CommandRegistry, Command, CommandService, PreferenceSchema, localize } from '@ali/ide-core-common';
import {
  KeybindingContribution, KeybindingRegistry, Logger,
  ClientAppContribution, IContextKeyService, PreferenceContribution,
} from '@ali/ide-core-browser';
import { Domain } from '@ali/ide-core-common/lib/di-helper';
import { MenuContribution, MenuModelRegistry, MenuPath } from '@ali/ide-core-common/lib/menu';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { Disposable } from '@ali/ide-core-common/lib/disposable';
import { getColorRegistry } from '@ali/ide-theme/lib/common/color-registry';
import { localize } from '@ali/ide-core-common';

import { SCMResourceView, SCMProviderList } from './scm.view';
import { ISCMService, SCMService, scmResourceViewId, scmProviderViewId, scmContainerId, scmPanelTitle } from '../common';
import { SCMBadgeController, SCMStatusBarController, SCMViewController } from './scm-activity';
import { scmPreferenceSchema } from './scm-preference';
import { DirtyDiffWorkbenchController } from './dirty-diff';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

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

  @Autowired(SCMBadgeController)
  protected readonly statusUpdater: SCMBadgeController;

  @Autowired(SCMStatusBarController)
  protected readonly statusBarController: SCMStatusBarController;

  @Autowired(SCMViewController)
  protected readonly scmViewController: SCMViewController;

  @Autowired(DirtyDiffWorkbenchController)
  protected readonly dirtyDiffWorkbenchController: DirtyDiffWorkbenchController;

  private toDispose = new Disposable();

  schema: PreferenceSchema = scmPreferenceSchema;

  onDidStart() {
    [
      this.statusUpdater,
      this.statusBarController,
      this.dirtyDiffWorkbenchController,
      this.scmViewController,
    ].forEach((controller) => {
      controller.start();
      this.toDispose.addDispose(controller);
    });
  }

  onDidUseConfig() {
    // 初始化渲染
    this.scmViewController.initRender();
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
    registry.register('@ali/ide-scm', [{
      component: SCMProviderList,
      id: scmProviderViewId,
      name: localize('scm.provider.title'),
      hidden: true,
      forceHidden: true,
      forceHidden: true,
      noToolbar: true,
    }, {
      component: SCMResourceView,
      id: scmResourceViewId,
      name: '',
    }], {
      iconClass: getIcon('scm'),
      title: scmPanelTitle,
      priority: 8,
      containerId: scmContainerId,
      activateKeyBinding: 'ctrl+shift+g',
    });
  }
}
