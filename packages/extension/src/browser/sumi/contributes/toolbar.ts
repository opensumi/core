import { Injectable, Autowired } from '@opensumi/di';
import { IJSONSchema, IToolbarRegistry } from '@opensumi/ide-core-browser';
import { LifeCyclePhase } from '@opensumi/ide-core-browser/lib/bootstrap/lifecycle.service';
import { toolbar } from '@opensumi/ide-core-browser/lib/extensions/schema/toolbar';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';
import { KaitianExtensionToolbarService } from '../main.thread.toolbar';
import { IToolbarButtonContribution, IToolbarSelectContribution, IToolbarActionBasicContribution } from '../types';

export interface KtToolbarSchema {
  actions?: Array<IToolbarButtonContribution | IToolbarSelectContribution>;
  groups?: Array<{
    id: string;
    preferredLocation?: string;
    weight?: number;
  }>;
}

@Injectable()
@Contributes('toolbar')
@LifeCycle(LifeCyclePhase.Starting)
export class ToolbarContributionPoint extends VSCodeContributePoint<KtToolbarSchema> {
  @Autowired()
  private readonly kaitianExtToolbarService: KaitianExtensionToolbarService;

  @Autowired(IToolbarRegistry)
  private readonly toolbarRegistry: IToolbarRegistry;

  @Autowired(AbstractExtInstanceManagementService)
  protected readonly extensionManageService: AbstractExtInstanceManagementService;

  static schema: IJSONSchema = toolbar.schema;

  private toLocalized<T extends IToolbarActionBasicContribution>(action: T, props: string[], extensionId: string): T {
    return props.reduce((pre, cur) => {
      if (pre[cur]) {
        pre[cur] = this.getLocalizeFromNlsJSON(pre[cur], extensionId);
      }
      return pre;
    }, action);
  }

  contribute() {
    for (const contrib of this.contributesMap) {
      const { extensionId, contributes } = contrib;
      const extension = this.extensionManageService.getExtensionInstanceByExtId(extensionId);
      if (!extension) {
        continue;
      }

      if (contributes.groups) {
        for (const group of contributes.groups) {
          this.addDispose(
            this.toolbarRegistry.registerToolbarActionGroup({
              id: group.id,
              preferredLocation: group.preferredLocation,
              weight: group.weight,
            }),
          );
        }
      }
      if (contributes.actions) {
        for (const toolbarAction of contributes.actions) {
          if (toolbarAction.type === 'button') {
            this.addDispose(
              this.kaitianExtToolbarService.registerToolbarButton(
                extensionId,
                extension.path,
                this.toLocalized(toolbarAction, ['title'], extensionId),
              ),
            );
          } else if (toolbarAction.type === 'select') {
            this.addDispose(
              this.kaitianExtToolbarService.registerToolbarSelect(
                extensionId,
                extension.path,
                this.toLocalized(toolbarAction, ['description'], extensionId),
              ),
            );
          }
        }
      }
    }
  }
}
