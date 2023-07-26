import { Injectable, Autowired } from '@opensumi/di';
import { IJSONSchema, IToolbarRegistry } from '@opensumi/ide-core-browser';
import { toolbar } from '@opensumi/ide-core-browser/lib/extensions/schema/toolbar';
import { LifeCyclePhase } from '@opensumi/ide-core-common';

import { VSCodeContributePoint, Contributes, LifeCycle } from '../../../common';
import { AbstractExtInstanceManagementService } from '../../types';
import { KaitianExtensionToolbarService } from '../main.thread.toolbar';
import {
  IToolbarButtonContribution,
  IToolbarSelectContribution,
  IToolbarActionBasicContribution,
  IToolbarDropdownButtonContribution,
} from '../types';

export interface KtToolbarSchema {
  actions?: Array<IToolbarButtonContribution | IToolbarSelectContribution | IToolbarDropdownButtonContribution>;
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
          switch (toolbarAction.type) {
            case 'button':
              this.addDispose(
                this.kaitianExtToolbarService.registerToolbarButton(
                  extensionId,
                  extension.path,
                  this.toLocalized(toolbarAction, ['title'], extensionId),
                ),
              );
              break;
            case 'select':
              this.addDispose(
                this.kaitianExtToolbarService.registerToolbarSelect(
                  extensionId,
                  extension.path,
                  this.toLocalized(toolbarAction, ['description'], extensionId),
                ),
              );
              break;
            case 'dropdownButton':
              this.addDispose(
                this.kaitianExtToolbarService.registerToolbarDropdownButton(
                  extensionId,
                  extension.path,
                  this.toLocalized(toolbarAction, ['description'], extensionId),
                ),
              );
              break;
          }
        }
      }
    }
  }
}
