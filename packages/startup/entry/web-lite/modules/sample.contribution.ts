import { Autowired } from '@ali/common-di';
import { Domain, CommandService, ComponentContribution, ComponentRegistry, getIcon } from '@ali/ide-core-browser';
import { ClientAppContribution } from '@ali/ide-core-browser';

import { IMetaService } from '../services/meta-service/base';
import { toSCMUri } from '../utils/scm-uri';
import { SampleView, SampleTopView, SampleBottomView, SampleMainView } from './view/sample.view';

@Domain(ClientAppContribution, ComponentContribution)
export class SampleContribution implements ClientAppContribution, ComponentContribution {

  @Autowired(CommandService)
  private readonly commands: CommandService;

  @Autowired(IMetaService)
  private readonly metaService: IMetaService;

  onDidStart() {
    const gitUri = toSCMUri({
      platform: 'git',
      repo: this.metaService.repo!,
      path: '/README.md',
      ref: 'a9b8074f',
    });
    this.commands.executeCommand(
      'vscode.open',
      gitUri.codeUri,
      { preview: false },
    );
  }

  // 注册视图和token的绑定关系
  registerComponent(registry: ComponentRegistry) {
    registry.register('@ali/ide-dw', [
      {
        id: 'dw-view1',
        component: SampleView,
        name: 'dw手风琴视图1',
      },
      {
        id: 'dw-view2',
        component: SampleView,
        name: 'dw手风琴视图2',
      },
    ], {
      containerId: 'ide-dw',
      title: 'Hello DW',
      priority: 10,
      iconClass: getIcon('explorer'),
    });

    registry.register('@ali/ide-dw-right', [
      {
        id: 'dw-view3',
        component: SampleView,
        name: 'dw手风琴视图3',
      },
      {
        id: 'dw-view4',
        component: SampleView,
        name: 'dw手风琴视图4',
      },
    ], {
      containerId: 'ide-dw-right',
      title: 'HelloDW2',
      priority: 10,
      iconClass: getIcon('debug'),
    });

    registry.register('@ali/ide-mock-top', {
      id: 'fake-top',
      component: SampleTopView,
    });

    registry.register('@ali/ide-mock-bottom', {
      id: 'fake-bottom',
      component: SampleBottomView,
    });

    registry.register('@ali/ide-mock-main', {
      id: 'fake-main',
      component: SampleMainView,
    });
  }
}
