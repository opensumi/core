import { observable, ObservableMap } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import { Disposable } from '@ali/ide-core-browser';

import { IToolbarActionGroup, IToolbarActionService } from '@ali/ide-core-browser/lib/menu/next';

export interface IToolbarActionStore {
  getActionGroups: () => IToolbarActionGroup[];
  toolbarActionGroups: ObservableMap<string, IToolbarActionGroup>;
}

export const IToolbarActionStore = Symbol('IToolbarActionStore');

@Injectable()
export class ToolbarActionStore extends Disposable implements IToolbarActionStore {

  @observable
  toolbarActionGroups = observable.map<string, IToolbarActionGroup>();

  @Autowired(IToolbarActionService)
  private toolbarActionService: IToolbarActionService;

  constructor() {
    super();
    // 可能存在(大概率)视图模块在插件 contribute 才初始化，实例化时先同步 service 的数据
    this.toolbarActionGroups = observable.map(this.toolbarActionService.getActionGroups());
    this.addDispose(
      this.toolbarActionService.onDidRegistryToolbarActionGroup(this.handleRegistryActionGroup.bind(this)),
    );
    this.addDispose(
      this.toolbarActionService.onDidUnRegistryToolbarActionGroup(this.handleUnRegistryActionGroup.bind(this)),
    );
  }

  public getActionGroups(): IToolbarActionGroup[] {
    return Array.from(this.toolbarActionGroups.values());
  }

  private handleRegistryActionGroup({ id, group }) {
    this.toolbarActionGroups.set(id, group);
  }

  private handleUnRegistryActionGroup(id) {
    this.toolbarActionGroups.delete(id);
  }
}
