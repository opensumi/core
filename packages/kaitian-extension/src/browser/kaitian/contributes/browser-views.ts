import { Injectable, Autowired } from '@ali/common-di';
import { VSCodeContributePoint, Contributes } from '../../../common';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { DisposableCollection } from '@ali/ide-core-node';
import { getIcon, RenderedEvent, IEventBus } from '@ali/ide-core-browser';
import { ExtensionLoadingView } from '../../components';
import { IIconService } from '@ali/ide-theme';

export type KtViewLocation = 'left' | 'right' | 'bottom' | 'editor' | 'toolBar';

export type KtViewsContribution = {
  [key in KtViewLocation]: {
    type: string;
    view: KtViewItem[];
  };
};

export interface KtViewItem {
  id: string;
  when: string;
  title: string;
  icon?: string;
  iconPath?: string;
  priority?: number;
  noResize?: boolean;
  expanded?: boolean;
}

export type KtViewsSchema = Array<KtViewsContribution>;

@Injectable()
@Contributes('browserViews')
export class KtViewContributionPoint extends VSCodeContributePoint<KtViewsContribution> {

  @Autowired(IMainLayoutService)
  mainlayoutService: IMainLayoutService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(IEventBus)
  eventBus: IEventBus;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  static tabBarLocation = ['left', 'right'];

  contribute() {
    this.addDispose(
      this.eventBus.once(RenderedEvent, () => {
        // 只提前注册左右面板
        const keys = Object.keys(this.json).filter((key) => KtViewContributionPoint.tabBarLocation.includes(key));
        for (const location of keys) {
          const views = this.json[location].view.map((view) => {
            return {
              ...view,
              component: ExtensionLoadingView,
            };
          });
          for (const view of views) {
            const { title, icon, iconPath, id, priority, component, expanded, noResize } = view;
            const containerId = `${this.extension.id}:${id}`;
            const handlerId = this.mainlayoutService.collectTabbarComponent([{
              id,
              priority,
              component,
            }], {
              iconClass: iconPath ? this.iconService.fromIcon(this.extension.path, iconPath) : getIcon(icon!),
              title,
              priority,
              expanded,
              containerId,
              noResize,
              fromExtension: true,
            }, location);
            this.disposableCollection.push({
              dispose: () => {
                const handler = this.mainlayoutService.getTabbarHandler(handlerId)!;
                handler.dispose();
              },
            });
          }
        }
      }),
    );
  }
}
