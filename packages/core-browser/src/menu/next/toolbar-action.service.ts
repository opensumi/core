import { Injectable } from '@ali/common-di';
import { IDisposable, Disposable } from '@ali/ide-core-common/lib/disposable';
import { Event, Emitter } from '@ali/ide-core-common/lib/event';

interface IDescriptor {
  title: string;
  description?: string;
}

interface IToolbarAction extends IDescriptor {
  type: 'action';
  click: (args: any) => void;
  iconClass?: string;
  iconPath?: string;
}

interface IToolbarSelect extends IDescriptor {
  type: 'enum';
  select: (value: string) => void;
  enum: string[];
  defaultValue?: string;
}

export type IToolbarActionGroup = Array<IToolbarAction | IToolbarSelect>;

export const IToolbarActionService = Symbol('IToolBarActionsService');

export interface IToolbarActionService {
  registryActionGroup(id: string, groups: IToolbarActionGroup): IDisposable;
  unRegistryActionGroup(id: string): void;
  getActionGroups(): Map<string, IToolbarActionGroup>;
  getActionGroup(id: string): IToolbarActionGroup | undefined;
  onDidRegistryToolbarActionGroup: Event<{ id: string; group: IToolbarActionGroup }>;
  onDidUnRegistryToolbarActionGroup: Event<string>;
}

@Injectable()
export class ToolbarActionService extends Disposable implements IToolbarActionService {
  private groups: Map<string, IToolbarActionGroup> = new Map();

  private _onDidRegistryToolbarActionGroup = new Emitter<{ id: string; group: IToolbarActionGroup }>();
  public onDidRegistryToolbarActionGroup = this._onDidRegistryToolbarActionGroup.event;

  private _onDidUnRegistryToolbarActionGroup = new Emitter<string>();
  public onDidUnRegistryToolbarActionGroup = this._onDidUnRegistryToolbarActionGroup.event;

  public getActionGroups() {
    return this.groups;
  }

  public getActionGroup(id: string) {
    return this.groups.get(id);
  }

  public registryActionGroup(id: string, group: IToolbarActionGroup): IDisposable {
    this.groups.set(id, group);
    this._onDidRegistryToolbarActionGroup.fire({ id, group });
    return {
      dispose: () => {
        this.groups.delete(id);
        this._onDidUnRegistryToolbarActionGroup.fire(id);
      },
    };
  }

  public unRegistryActionGroup(id: string) {
    if (this.groups.has(id)) {
      this._onDidUnRegistryToolbarActionGroup.fire(id);
      this.groups.delete(id);
    }
  }
}
