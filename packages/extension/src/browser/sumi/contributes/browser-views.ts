import { Injectable, Autowired } from '@opensumi/di';
import { getIcon } from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { browserViews } from '@opensumi/ide-core-browser/lib/extensions/schema/browserViews';
import { DisposableCollection, getDebugLogger } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { IIconService } from '@opensumi/ide-theme';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { ExtensionLoadingView } from '../../components';
import { AbstractExtInstanceManagementService } from '../../types';

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
  hideTab?: boolean;
  expanded?: boolean;
  weight?: number;
  titleComponentId?: string;
}

export type KtViewsSchema = Array<KtViewsContribution>;

const SUPPORT_LOCATION = ['left', 'right', 'bottom', 'editor', 'toolBar', 'editorSide'];

@Injectable()
@Contributes('browserViews')
@LifeCycle(LifeCyclePhase.Starting)
export class BrowserViewContributionPoint extends VSCodeContributePoint<KtViewsContribution> {
  @Autowired(IMainLayoutService)
  mainLayoutService: IMainLayoutService;

  @Autowired(IIconService)
  iconService: IIconService;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  static schema = browserViews.schema;

  private disposableCollection: DisposableCollection = new DisposableCollection();

  // 不支持提前加载的视图
  static unsupportLocation = ['bottom', 'editor', 'toolBar'];

  contribute() {
    this.mainLayoutService.viewReady.promise.then(() => {
      for (const contrib of this.contributesMap) {
        const { extensionId, contributes } = contrib;
        const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
        if (!extension) {
          continue;
        }

        const keys = Object.keys(contributes).filter(
          (key) => !BrowserViewContributionPoint.unsupportLocation.includes(key),
        );
        for (let location of keys) {
          const views = contributes[location].view.map((view) => ({
            ...view,
            component: ExtensionLoadingView,
          }));
          if (!SUPPORT_LOCATION.includes(location)) {
            if (!this.mainLayoutService.getTabbarHandler(location)) {
              // 若目标视图不存在，append将fallback到add模式添加到左侧边栏
              location = 'left';
            } else {
              // 走append view逻辑
              for (const view of views) {
                if (view.titleComponentId) {
                  getDebugLogger().warn(
                    `custom title component '${view.titleComponentId}' is not allowed for built-in container ${location}!`,
                  );
                }
                const { title, id, priority, component, when, weight } = view;
                // 支持指定通过 location 获取 containerId 的方式
                const containerId = this.mainLayoutService.getTabbarHandler(location)?.containerId || location;
                const handlerId = this.mainLayoutService.collectViewComponent(
                  {
                    id,
                    priority,
                    component,
                    name: title,
                    when,
                    weight,
                  },
                  containerId,
                  {},
                  {
                    fromExtension: true,
                  },
                );
                this.disposableCollection.push({
                  dispose: () => {
                    const handler = this.mainLayoutService.getTabbarHandler(handlerId)!;
                    handler.disposeView(id);
                  },
                });
              }
              return;
            }
          }
          for (const view of views) {
            const { title, icon, iconPath, id, priority, component, expanded, noResize, when, weight, hideTab } = view;
            const containerId = `${extensionId}:${id}`;
            const handlerId = this.mainLayoutService.collectTabbarComponent(
              [
                {
                  id,
                  priority,
                  component,
                  when,
                  weight,
                },
              ],
              {
                iconClass: iconPath ? this.iconService.fromIcon(extension.path, iconPath) : getIcon(icon!),
                title: title && this.getLocalizeFromNlsJSON(title, extensionId),
                priority,
                expanded,
                containerId,
                noResize,
                fromExtension: true,
                hideTab,
              },
              location,
            );
            this.disposableCollection.push({
              dispose: () => {
                const handler = this.mainLayoutService.getTabbarHandler(handlerId)!;
                handler.dispose();
              },
            });
          }
        }
      }
    });
  }
}
