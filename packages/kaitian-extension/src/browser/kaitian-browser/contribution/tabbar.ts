import { IRunParam, IKaitianBrowserContributions, AbstractKaitianBrowserContributionRunner, ITabBarComponentContribution } from '../types';
import { IDisposable, Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IExtension } from '../../../common';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { getIcon } from '@ali/ide-core-browser';
import { IIconService } from '@ali/ide-theme';

@Injectable({multiple: true})
export class TabbarBrowserContributionRunner extends AbstractKaitianBrowserContributionRunner {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(IIconService)
  iconService: IIconService;

  run(param: IRunParam): IDisposable {
    const disposer = new Disposable();

    if (this.contribution.left) {
      this.contribution.left.component.forEach((component) => {
        disposer.addDispose(this.registerTabBar(component, 'left', param));
      });
    }

    if (this.contribution.right) {
      this.contribution.right.component.forEach((component) => {
        disposer.addDispose(this.registerTabBar(component, 'right', param));
      });
    }

    if (this.contribution.bottom) {
      this.contribution.bottom.component.forEach((component) => {
        disposer.addDispose(this.registerTabBar(component, 'bottom', param));
      });
    }

    return disposer;

  }

  registerTabBar(component: ITabBarComponentContribution, position: 'left' | 'right' | 'bottom', runParam: IRunParam): IDisposable {
    const { extendProtocol, extendService } = runParam.getExtensionExtendService(this.extension, component.id);
    const componentId = this.layoutService.collectTabbarComponent(
      [{
        id: `${this.extension.id}:${component.id}`,
        component: position === 'bottom' ? component.panel : undefined,
      }],
      {
        iconClass: component.icon ? getIcon(component.icon) : component.iconPath ? this.iconService.fromIcon(this.extension.path, component.iconPath) : '',
        containerId: `${this.extension.id}:${component.id}`,
        component: position !== 'bottom' ? component.panel : undefined,
        initialProps: {
          kaitianExtendService: extendService,
          kaitianExtendSet: extendProtocol,
        },
        activateKeyBinding: component.keyBinding,
        title: component.title,
        priority: component.priority,
        noResize: component.noResize,
      },
      position,
    );
    return {
      dispose: () => {
        const componentHandler = this.layoutService.getTabbarHandler(componentId);

        if (componentHandler) {
          componentHandler.dispose();
        }
      },
    };
  }

}
