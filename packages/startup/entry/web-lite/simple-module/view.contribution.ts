import { Injectable } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common';
import { ComponentContribution, ComponentRegistry, getIcon, SlotRendererContribution, SlotRendererRegistry, SlotLocation } from '@ali/ide-core-browser';

import { SampleView, SampleTopView, SampleBottomView, SampleMainView } from './sample.view';
import { RightTabRenderer } from './custom-renderer';

@Injectable()
@Domain(ComponentContribution, SlotRendererContribution)
export class ViewContribution implements ComponentContribution, SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry) {
    registry.registerSlotRenderer(SlotLocation.right, RightTabRenderer);
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
