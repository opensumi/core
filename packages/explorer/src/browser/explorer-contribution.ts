import { localize, Domain } from '@ali/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ali/ide-core-browser/lib/layout';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { ExplorerContainer } from './explorer.view';

export const ExplorerContainerId = 'explorer';

@Domain(ComponentContribution)
export class ExplorerContribution implements ComponentContribution {
  // Explorer 只注册容器
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-explorer', [
      // TODO: 支持只注册容器，不注册View
      {
        component: ExplorerContainer,
        id: 'explorer-container',
        weight: 0,
        collapsed: false,
      },
    ], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: ExplorerContainerId,
      activateKeyBinding: 'shift+ctrlcmd+e',
    });
  }
}
