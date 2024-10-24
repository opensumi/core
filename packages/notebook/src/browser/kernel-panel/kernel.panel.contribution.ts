import { Autowired } from '@opensumi/di';
import { ComponentContribution, ComponentRegistry, Domain } from '@opensumi/ide-core-browser';
import { IconService } from '@opensumi/ide-theme/lib/browser';
import { IconType } from '@opensumi/ide-theme/lib/common';

import { KernelPanel } from './kernel-panel-view';
import { KERNEL_PANEL_ID } from './kernel.panel.protocol';

@Domain(ComponentContribution)
export class KernelPanelContribution implements ComponentContribution {
  @Autowired(IconService)
  protected readonly iconService: IconService;

  registerComponent(registry: ComponentRegistry) {
    const iconClass = this.iconService.fromIcon(
      '',
      {
        dark: 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*ae86Sq9KTxcAAAAAAAAAAAAADiuUAQ/original',
        light: 'https://mdn.alipayobjects.com/huamei_xt20ge/afts/img/A*fWPISIBPGfsAAAAAAAAAAAAADiuUAQ/original',
      },
      IconType.Background,
    );
    registry.register('@opensumi/ide-notebook', [], {
      containerId: KERNEL_PANEL_ID,
      iconClass,
      title: '运行的终端和内核',
      component: KernelPanel,
      priority: 0,
      activateKeyBinding: 'ctrlcmd+shift+k',
    });
  }
}
