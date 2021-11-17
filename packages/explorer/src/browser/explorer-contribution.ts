import { localize, Domain } from '@ide-framework/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@ide-framework/ide-core-browser/lib/layout';
import { getIcon } from '@ide-framework/ide-core-browser';

export const ExplorerContainerId = 'explorer';

@Domain(ComponentContribution)
export class ExplorerContribution implements ComponentContribution {
  // Explorer 只注册容器
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ide-framework/ide-explorer', [], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: ExplorerContainerId,
    });
  }
}
