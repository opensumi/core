import { Injectable, Autowired } from '@opensumi/di';
import { IDisposable, Emitter, WithEventBus, ContributionProvider, Domain } from '@opensumi/ide-core-common';

import { ClientAppContribution } from '../common';
import { PreferenceService } from '../preferences';

import {
  IToolbarRegistry,
  IToolbarActionGroup,
  IToolbarAction,
  IToolbarActionGroupForRender,
  IToolbarActionPosition,
  ToolbarActionsChangedEvent,
  ToolBarActionContribution,
  ToolbarActionGroupsChangedEvent,
  ToolbarRegistryReadyEvent,
} from './types';

type LocationName = string;
type GroupName = string;
type ActionId = string;

@Injectable()
export class NextToolbarRegistryImpl extends WithEventBus implements IToolbarRegistry {
  private locations: string[] = [];

  private _preferredDefaultLocation: string | undefined = undefined;

  private groups: Map<string, IToolbarActionGroup> = new Map();

  private actions: Map<string, IToolbarAction> = new Map();

  private computed: Map<LocationName, Map<GroupName, IToolbarAction[]>> = new Map();

  private computedReverse: Map<ActionId, IToolbarActionPosition> = new Map();

  private computedGroups: Map<LocationName, IToolbarActionGroup[]> = new Map();

  private _onGroupDisposed: Emitter<string> = new Emitter();

  private _onGroupAdded: Emitter<string> = new Emitter();

  private _onLocationAdded: Emitter<string> = new Emitter();

  private _onActionDisposed: Emitter<IToolbarAction> = new Emitter();

  private _onActionAdded: Emitter<IToolbarAction> = new Emitter();

  @Autowired(ToolBarActionContribution)
  contributions: ContributionProvider<ToolBarActionContribution>;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  private _inited = false;

  isReady() {
    return this._inited;
  }

  get defaultLocation(): string {
    if (this._preferredDefaultLocation && this.locations.indexOf(this._preferredDefaultLocation) > -1) {
      return this._preferredDefaultLocation;
    }
    return this.locations[0] || 'default';
  }

  getAllLocations(): string[] {
    return this.locations;
  }

  init() {
    const contributions = this.contributions.getContributions();
    contributions.forEach((c) => {
      if (c.registerToolbarActions) {
        c.registerToolbarActions(this);
      }
    });
    this.actions.forEach((action) => {
      this.calculateActionPosition(action);
    });
    this._inited = true;
    this._onActionDisposed.event((action) => {
      this.applyPosition(action, null);
    });
    this._onGroupDisposed.event((groupId) => {
      let actions: IToolbarAction[] | undefined;
      for (const location of this.computed.values()) {
        if (location.has(groupId)) {
          actions = location.get(groupId)!;
          break;
        }
      }
      if (actions) {
        actions.forEach((action) => {
          this.calculateActionPosition(action);
        });
      }
    });
    this._onGroupAdded.event((groupId) => {
      this.actions.forEach((action) => {
        if (
          (action.strictPosition && action.strictPosition.group === groupId) ||
          (action.preferredPosition && action.preferredPosition.group === groupId)
        ) {
          this.calculateActionPosition(action);
        }
      });
    });
    this._onActionAdded.event((action) => {
      this.calculateActionPosition(action);
    });
    this.eventBus.fire(new ToolbarRegistryReadyEvent());
  }

  hasLocation(locationName: string) {
    return locationName === 'default' || this.locations.indexOf(locationName) !== -1;
  }

  addLocation(locationName: string) {
    if (this.locations.indexOf(locationName) === -1) {
      this.locations.push(locationName);
      this._onLocationAdded.fire(locationName);
    }
  }

  setDefaultLocation(locationName: string) {
    this._preferredDefaultLocation = locationName;
  }

  registerToolbarActionGroup(group: IToolbarActionGroup): IDisposable {
    this.groups.set(group.id, group);
    this._onGroupAdded.fire(group.id);
    return {
      dispose: () => {
        this.groups.delete(group.id);
        this._onGroupDisposed.fire(group.id);
      },
    };
  }

  calculateActionPosition(action: IToolbarAction) {
    // strict location
    if (action.strictPosition) {
      if (action.strictPosition.group !== '_head' && action.strictPosition.group !== '_tail') {
        const group = this.groups.get(action.strictPosition.group);
        if (!group) {
          return;
        }
        const location = this.getGroupLocation(group);
        if (action.strictPosition.location && action.strictPosition.location !== location) {
          return;
        }
      } else {
        if (this.locations.indexOf(action.strictPosition.location) === -1) {
          return;
        }
      }
      this.applyPosition(action, action.strictPosition);
    } else {
      const position = this.getPositionFromPreferred(action.preferredPosition || {});
      this.applyPosition(action, position);
    }
  }

  private getPositionFromPreferred(preferredPosition: Partial<IToolbarActionPosition>) {
    const position: IToolbarActionPosition = {
      location: this.defaultLocation,
      group: '_tail',
    };

    if (preferredPosition.location && this.locations.indexOf(preferredPosition.location) > -1) {
      position.location = preferredPosition.location;
    }
    if (preferredPosition.group) {
      if (preferredPosition.group === '_tail' || preferredPosition.group === '_head') {
        position.group = preferredPosition.group;
      } else {
        const group = this.groups.get(preferredPosition.group);
        if (group) {
          // 如果存在对应group， 使用group 的location
          const location = this.getGroupLocation(group);
          position.location = location;
          position.group = group.id;
        }
      }
    }

    return position;
  }

  applyPosition(action: IToolbarAction, position: IToolbarActionPosition | null) {
    const changedPositions: IToolbarActionPosition[] = [];
    // 先删除之前的
    if (this.computedReverse.has(action.id)) {
      const previousPos = this.computedReverse.get(action.id)!;
      if (position && previousPos.location === position.location && previousPos.group === position.group) {
        // 未改变
        return;
      }
      const actions = this.computed.get(previousPos.location)!.get(previousPos.group)!;
      const index = actions.indexOf(action);
      if (index > -1) {
        actions.splice(index, 1);
      }
      changedPositions.push(previousPos);
      this.computedReverse.delete(action.id);
    }

    if (position) {
      // 放入当前的位置
      if (!this.computed.has(position.location)) {
        this.initLocation(position.location);
      }
      const nextActions = this.computed.get(position.location)!.get(position.group)!;

      let i = 0;
      for (; i < nextActions.length; i++) {
        if (nextActions[i] && (nextActions[i].weight || 0) < (action.weight || 0)) {
          break;
        }
      }
      nextActions.splice(i, 0, action);
      changedPositions.push(position);
      this.computedReverse.set(action.id, position);
    }

    if (this._inited) {
      changedPositions.forEach((position) => {
        this.eventBus.fire(
          new ToolbarActionsChangedEvent({
            position,
          }),
        );
      });
    }
  }

  getGroupLocation(group: IToolbarActionGroup): string {
    for (const l of this.computed.keys()) {
      if (this.computed.has(l) && this.computed.get(l)!.has(group.id)) {
        return l;
      }
    }

    let location = this.defaultLocation;
    // 首次计算 group 位置
    if (group.preferredLocation && this.locations.indexOf(group.preferredLocation) > -1) {
      location = group.preferredLocation;
    }

    if (!this.computed.has(location)) {
      this.initLocation(location);
    }
    this.computed.get(location)!.set(group.id, []);

    const groups = this.computedGroups.get(location)!;

    let i = 0;
    for (; i < groups.length; i++) {
      if (groups[i] && (groups[i].weight || 0) < (group.weight || 0)) {
        break;
      }
    }
    groups.splice(i, 0, group);

    this.eventBus.fire(new ToolbarActionGroupsChangedEvent({ location }));

    return location;
  }

  initLocation(location: LocationName) {
    this.computed.set(location, new Map());
    this.computed.get(location)!.set('_head', []);
    this.computed.get(location)!.set('_tail', []);
    this.computedGroups.set(location, []);
  }

  registerToolbarAction(action: IToolbarAction): IDisposable {
    this.actions.set(action.id, action);
    this._onActionAdded.fire(action);
    return {
      dispose: () => {
        this.actions.delete(action.id);
        this._onActionDisposed.fire(action);
      },
    };
  }

  getToolbarActions(position: IToolbarActionPosition): IToolbarActionGroupForRender | undefined {
    const groups = this.computed.get(position.location);
    if (!groups || !this.isValidGroup(position.group)) {
      return;
    }
    const actions = groups.get(position.group);
    if (!actions) {
      return;
    }

    return {
      group: this.groups.get(position.group)!,
      position,
      actions,
    };
  }

  getActionGroups(location: string) {
    return this.computedGroups.get(location);
  }

  isValidGroup(groupId: string) {
    return groupId === '_head' || groupId === '_tail' || this.groups.has(groupId);
  }

  getActionPosition(actionId: string) {
    return this.computedReverse.get(actionId);
  }
}

@Domain(ClientAppContribution)
export class ToolbarClientAppContribution implements ClientAppContribution {
  @Autowired(IToolbarRegistry)
  toolbarRegistry: IToolbarRegistry;

  onStart() {
    (this.toolbarRegistry as NextToolbarRegistryImpl).init();
  }
}
