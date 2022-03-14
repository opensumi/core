import { localize, Domain } from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

export const ExplorerContainerId = 'explorer';

@Domain(ComponentContribution)
export class ExplorerContribution implements ComponentContribution {
  // Explorer 只注册容器
  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-explorer', [], {
      iconClass: getIcon('explorer'),
      title: localize('explorer.title'),
      priority: 10,
      containerId: ExplorerContainerId,
    });
  }
}
