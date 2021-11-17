import { IRunTimeParams, AbstractKaitianBrowserContributionRunner } from '../types';
import { IDisposable, Disposable, ILogger } from '@ide-framework/ide-core-common';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ide-framework/common-di';
import { IMainLayoutService } from '@ide-framework/ide-main-layout';
import { IIconService } from '@ide-framework/ide-theme';
import { IToolBarViewService, ToolBarPosition } from '@ide-framework/ide-toolbar/lib/browser';

@Injectable({multiple: true})
export class ToolBarBrowserContributionRunner extends AbstractKaitianBrowserContributionRunner {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(IToolBarViewService)
  toolBarViewService: IToolBarViewService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(ILogger)
  logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  run(param: IRunTimeParams): IDisposable {
    const disposer = new Disposable();
    if (!this.injector.creatorMap.has(IToolBarViewService)) {
      this.logger.warn('没有找到 toolbarViewService');
      return disposer;
    }

    if (this.contribution.toolBar) {
      this.contribution.toolBar.view.forEach((view) => {
        const { extendProtocol, extendService } = param.getExtensionExtendService(this.extension, view.id);
        const disposable = this.toolBarViewService.registerToolBarElement({
          type: 'component',
          component: view.component as React.ComponentType,
          position: view.position || this.contribution.toolBar!.position || ToolBarPosition.LEFT,
          initialProps: {
            kaitianExtendService: extendService,
            kaitianExtendSet: extendProtocol,
          },
          description: view.description,
          order: view.order,
          weight: view.weight,
        });
        if (disposable) {
          disposer.addDispose(disposable);
        }
      });
    }

    return disposer;

  }
}
