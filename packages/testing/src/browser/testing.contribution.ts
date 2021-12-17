import { Injectable, Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  getIcon,
  localize,
} from '@opensumi/ide-core-browser';

import { TestingContainerId, TestingViewId } from '../common/testing-view';
import { ITestTreeViewModel, TestTreeViewModelToken } from '../common/tree-view.model';
import { TestingView } from './components/testing.view';

@Injectable()
@Domain(ClientAppContribution, ComponentContribution)
export class TestingContribution implements ClientAppContribution, ComponentContribution {
  @Autowired(TestTreeViewModelToken)
  private readonly testTreeViewModel: ITestTreeViewModel;

  initialize(): void {
    this.testTreeViewModel.initTreeModel();
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(TestingViewId, [], {
      iconClass: getIcon('test'),
      title: localize('test.title'),
      priority: 1,
      containerId: TestingContainerId,
      component: TestingView,
      activateKeyBinding: 'ctrlcmd+shift+t',
    });
  }
}
