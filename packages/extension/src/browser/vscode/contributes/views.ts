import { Injectable, Autowired } from '@opensumi/di';
import { DisposableCollection } from '@opensumi/ide-core-browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';

import { VSCodeContributePoint, Contributes } from '../../../common';
import { ExtensionWebviewView } from '../../components/extension-webview-view';

export interface ViewsContribution {
  [key: string]: Array<ViewItem>;
}

export interface ViewItem {
  id: string;
  name: string;
  when: string;
  weight?: number;
  priority?: number;
  type?: 'tree' | 'webview';
}

export type ViewsSchema = ViewsContribution;

@Injectable()
@Contributes('views')
export class ViewsContributionPoint extends VSCodeContributePoint<ViewsSchema> {
  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  contribute() {
    for (const location of Object.keys(this.json)) {
      const views = this.json[location].map((view: ViewItem) => ({
        ...view,
        name: this.getLocalizeFromNlsJSON(view.name),
        component: view.type === 'webview' ? ExtensionWebviewView : WelcomeView,
      }));
      for (const view of views) {
        const handlerId = this.mainlayoutService.collectViewComponent(
          view,
          location,
          { viewId: view.id },
          {
            fromExtension: true,
          },
        );
        this.disposableCollection.push({
          dispose: () => {
            const handler = this.mainlayoutService.getTabbarHandler(handlerId);
            handler?.disposeView(view.id);
          },
        });
      }
    }
  }

  dispose() {
    this.disposableCollection.dispose();
  }
}
