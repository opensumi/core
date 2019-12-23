import { IRunParam, IKaitianBrowserContributions, AbstractKaitianBrowserContributionRunner, IEditorComponentContribution } from '../types';
import { IDisposable, Disposable, URI } from '@ali/ide-core-common';
import { Injectable, Autowired } from '@ali/common-di';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { IIconService } from '@ali/ide-theme';
import { IToolBarViewService, ToolBarPosition } from '@ali/ide-toolbar/lib/browser';

@Injectable({multiple: true})
export class ToolBarBrowserContributionRunner extends AbstractKaitianBrowserContributionRunner {

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  @Autowired(IToolBarViewService)
  toolBarViewService: IToolBarViewService;

  @Autowired(IIconService)
  iconService: IIconService;

  run(param: IRunParam): IDisposable {
    const disposer = new Disposable();

    if (this.contribution.toolbar) {
      this.contribution.toolbar.component.forEach((component) => {
        const { extendProtocol, extendService } = param.getExtensionExtendService(this.extension, component.id);
        this.toolBarViewService.registerToolBarElement({
          type: 'component',
          component: component.panel as React.FunctionComponent | React.ComponentClass,
          position: component.position || this.contribution.toolbar!.position || ToolBarPosition.LEFT,
          initialProps: {
            kaitianExtendService: extendService,
            kaitianExtendSet: extendProtocol,
          },
        });
      });
    }

    return disposer;

  }
}
