import { IRunTimeParams, AbstractKaitianBrowserContributionRunner, ITabBarViewContribution } from '../types';
import { IDisposable, Disposable } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { getIcon } from '@ali/ide-core-browser';
import { IIconService } from '@ali/ide-theme';

const SUPPORT_LOCATION = [ 'left', 'right', 'bottom', 'editor', 'toolBar' ];

@Injectable({multiple: true})
export class TabbarBrowserContributionRunner extends AbstractKaitianBrowserContributionRunner {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(IIconService)
  iconService: IIconService;

  run(params: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    if (this.contribution.left) {
      this.contribution.left.view.forEach((view) => {
        disposer.addDispose(this.registerTabBar(view, params, this.contribution.left?.type, 'left'));
      });
    }

    if (this.contribution.right) {
      this.contribution.right.view.forEach((view) => {
        disposer.addDispose(this.registerTabBar(view, params, this.contribution.right?.type, 'right'));
      });
    }

    if (this.contribution.bottom) {
      this.contribution.bottom.view.forEach((view) => {
        disposer.addDispose(this.registerTabBar(view, params, this.contribution.bottom?.type, 'bottom'));
      });
    }

    Object.keys(this.contribution).forEach((location) => {
      if (SUPPORT_LOCATION.indexOf(location) === -1) {
        (this.contribution[location]?.view as ITabBarViewContribution[]).forEach((view) => {
          disposer.addDispose(this.registerTabBar(view, params, 'replace'));
        });
      }
    });

    return disposer;

  }

  registerTabBar(view: ITabBarViewContribution, runtimeParams: IRunTimeParams, kind: 'add' | 'replace' = 'add', position?: 'left' | 'right' | 'bottom'): IDisposable {
    const { extendProtocol, extendService } = runtimeParams.getExtensionExtendService(this.extension, view.id);
    let componentId;
    const initialProps = {
      kaitianExtendService: extendService,
      kaitianExtendSet: extendProtocol,
    };
    if (kind === 'add') {
      const { component } = view;
      const containerId = `${this.extension.id}:${view.id}`;
      componentId = this.layoutService.collectTabbarComponent(
        [{
          id: containerId,
        }],
        {
          ...view,
          iconClass: view.icon ? getIcon(view.icon) : view.iconPath ? this.iconService.fromIcon(this.extension.path, view.iconPath) : '',
          containerId,
          component,
          initialProps,
          fromExtension: true,
        },
        position!,
      );
    } else {
      this.layoutService.replaceViewComponent(view, initialProps);
    }
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
