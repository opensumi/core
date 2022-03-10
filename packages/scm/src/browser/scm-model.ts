import { action, observable } from 'mobx';

import { Autowired, Injectable } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Disposable, Emitter, Event, getDebugLogger, Uri } from '@opensumi/ide-core-common';
import {
  combinedDisposable,
  dispose,
  DisposableStore,
  IDisposable,
  toDisposable,
} from '@opensumi/ide-core-common/lib/disposable';
import { ISplice } from '@opensumi/ide-core-common/lib/sequence';

import { ISCMMenus, ISCMRepository, ISCMResource, ISCMResourceGroup, SCMService } from '../common';

export interface IGroupItem {
  readonly group: ISCMResourceGroup;
  visible: boolean;
  readonly disposable: IDisposable;
}

export interface IResourceGroupSpliceEvent<T> {
  target: ISCMRepository;
  index: number;
  deleteCount: number;
  elements: T[];
}

export type ISCMDataItem = ISCMResourceGroup | ISCMResource;

export class ResourceGroupSplicer {
  private items: IGroupItem[] = [];
  private disposables: IDisposable[] = [];

  private _onDidSplice = new Emitter<IResourceGroupSpliceEvent<ISCMDataItem>>();
  readonly onDidSplice: Event<IResourceGroupSpliceEvent<ISCMDataItem>> = this._onDidSplice.event;

  constructor(private repository: ISCMRepository) {}

  run() {
    const groupSequence = this.repository.provider.groups;
    groupSequence.onDidSplice(this.onDidSpliceGroups, this, this.disposables);
    this.onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: groupSequence.elements });
  }

  private onDidSpliceGroups({ start, deleteCount, toInsert }: ISplice<ISCMResourceGroup>): void {
    let absoluteStart = 0;

    for (let i = 0; i < start; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    let absoluteDeleteCount = 0;

    for (let i = 0; i < deleteCount; i++) {
      const item = this.items[start + i];
      absoluteDeleteCount += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    const itemsToInsert: IGroupItem[] = [];
    const absoluteToInsert: Array<ISCMResourceGroup | ISCMResource> = [];

    for (const group of toInsert) {
      const visible = isGroupVisible(group);

      if (visible) {
        absoluteToInsert.push(group);
      }

      for (const element of group.elements) {
        absoluteToInsert.push(element);
      }

      const disposable = combinedDisposable([
        group.onDidChange(() => this.onDidChangeGroup(group)),
        group.onDidSplice((splice) => this.onDidSpliceGroup(group, splice)),
      ]);

      itemsToInsert.push({ group, visible, disposable });
    }

    const itemsToDispose = this.items.splice(start, deleteCount, ...itemsToInsert);

    for (const item of itemsToDispose) {
      item.disposable.dispose();
    }

    this._onDidSplice.fire({
      target: this.repository,
      index: absoluteStart,
      deleteCount: absoluteDeleteCount,
      elements: absoluteToInsert,
    });
  }

  private onDidChangeGroup(group: ISCMResourceGroup): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (item.visible === visible) {
      return;
    }

    let absoluteStart = 0;

    for (let i = 0; i < itemIndex; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    if (visible) {
      this._onDidSplice.fire({
        target: this.repository,
        index: absoluteStart,
        deleteCount: 0,
        elements: [group, ...group.elements],
      });
    } else {
      this._onDidSplice.fire({
        target: this.repository,
        index: absoluteStart,
        deleteCount: 1 + group.elements.length,
        elements: [],
      });
    }

    item.visible = visible;
  }

  private onDidSpliceGroup(group: ISCMResourceGroup, { start, deleteCount, toInsert }: ISplice<ISCMResource>): void {
    const itemIndex = this.items.findIndex((item) => item.group === group);

    if (itemIndex < 0) {
      return;
    }

    const item = this.items[itemIndex];
    const visible = isGroupVisible(group);

    if (!item.visible && !visible) {
      return;
    }

    let absoluteStart = start;

    for (let i = 0; i < itemIndex; i++) {
      const item = this.items[i];
      absoluteStart += (item.visible ? 1 : 0) + item.group.elements.length;
    }

    if (item.visible && !visible) {
      this._onDidSplice.fire({
        target: this.repository,
        index: absoluteStart,
        deleteCount: 1 + deleteCount,
        elements: toInsert,
      });
    } else if (!item.visible && visible) {
      this._onDidSplice.fire({
        target: this.repository,
        index: absoluteStart,
        deleteCount,
        elements: [group, ...toInsert],
      });
    } else {
      this._onDidSplice.fire({
        target: this.repository,
        index: absoluteStart + 1,
        deleteCount,
        elements: toInsert,
      });
    }

    item.visible = visible;
  }

  dispose(): void {
    this.onDidSpliceGroups({ start: 0, deleteCount: this.items.length, toInsert: [] });
    this.disposables = dispose(this.disposables);
  }
}

function isGroupVisible(group: ISCMResourceGroup) {
  return group.elements.length > 0 || !group.hideWhenEmpty;
}

@Injectable()
export class ViewModelContext extends Disposable {
  @Autowired(SCMService)
  private readonly scmService: SCMService;

  @Autowired(ISCMMenus)
  private readonly _menus: ISCMMenus;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private onDidSelectedRepoChangeEmitter: Emitter<ISCMRepository> = new Emitter();

  get onDidSelectedRepoChange() {
    return this.onDidSelectedRepoChangeEmitter.event;
  }

  public get menus(): ISCMMenus {
    return this._menus;
  }

  private logger = getDebugLogger();

  private toDisposableListener: IDisposable | null;

  private _onDidSCMListChangeEmitter: Emitter<void> = new Emitter();
  public onDidSCMListChange = this._onDidSCMListChangeEmitter.event;

  constructor() {
    super();
    this.start();

    this.initTreeAlwaysShowActions();

    this.scmService.onDidChangeSelectedRepositories(this._handleSelectedRepoChanged, this, this.disposables);
    this._handleSelectedRepoChanged(this.scmService.selectedRepositories);
  }

  private _handleSelectedRepoChanged(repos: ISCMRepository[]) {
    const [selectedRepo] = repos;
    if (!selectedRepo) {
      // handle all repo deleted
      return;
    }
    if (this.toDisposableListener) {
      this.toDisposableListener.dispose();
      this.toDisposableListener = null;
    }
    this.toDisposableListener = this.listenToCurrentRepo(selectedRepo);
  }

  private listenToCurrentRepo(repository: ISCMRepository): IDisposable {
    const disposables = new DisposableStore();
    const resourceGroup = new ResourceGroupSplicer(repository);

    // 只处理当前 repository 的事件
    const repoOnDidSplice = Event.filter(resourceGroup.onDidSplice, (e) => e.target === repository);
    disposables.add(
      repoOnDidSplice(({ index, deleteCount, elements }) => {
        if (repository.provider.rootUri) {
          // 只处理存在工作区路径的 SCMList
          this.spliceSCMList(repository.provider.rootUri, index, deleteCount, ...elements);
        }
      }),
    );

    resourceGroup.run();

    disposables.add(resourceGroup);
    return toDisposable(() => {
      disposables.clear();
    });
  }

  private initTreeAlwaysShowActions() {
    this.alwaysShowActions = !!this.preferenceService.get<boolean>('scm.alwaysShowActions');
    this.disposables.push(
      this.preferenceService.onSpecificPreferenceChange(
        'scm.alwaysShowActions',
        (changes) => (this.alwaysShowActions = changes.newValue),
      ),
    );
  }

  @observable
  public alwaysShowActions: boolean;

  start() {
    this.scmService.onDidAddRepository(
      (repo: ISCMRepository) => {
        this.addRepo(repo);
      },
      this,
      this.disposables,
    );

    this.scmService.onDidRemoveRepository(
      (repo: ISCMRepository) => {
        this.deleteRepo(repo);
      },
      this,
      this.disposables,
    );

    this.scmService.onDidChangeSelectedRepositories(
      (repos: ISCMRepository[]) => {
        this.changeSelectedRepos(repos);
      },
      this,
      this.disposables,
    );

    this.scmService.repositories.forEach((repo) => {
      this.addRepo(repo);
    });
  }

  @observable
  public repoList = observable.array<ISCMRepository>([]);

  @observable
  public selectedRepos = observable.array<ISCMRepository>([]);

  @observable
  public selectedRepo: ISCMRepository | undefined;

  public scmList = new Array<ISCMDataItem>();

  private _currentWorkspace: Uri;

  private spliceSCMList = (workspace: Uri, start: number, deleteCount: number, ...toInsert: ISCMDataItem[]) => {
    if (!this._currentWorkspace || this._currentWorkspace.toString() === workspace.toString()) {
      this.scmList.splice(start, deleteCount, ...toInsert);
    } else {
      this.scmList = [...toInsert];
    }
    this._currentWorkspace = workspace;
    this._onDidSCMListChangeEmitter.fire();
  };

  @action
  private addRepo(repo: ISCMRepository) {
    // 因为这里每个传入的 repo 均为新实例，这里需要通过 Uri.toString() 去判断
    if (
      this.repoList.find(
        (exist: ISCMRepository) => exist.provider.rootUri?.toString() === repo.provider.rootUri?.toString(),
      )
    ) {
      this.logger.warn('duplicate scm repo', repo);
      return;
    }
    this.repoList.push(repo);

    // 兜底: 避免由于生命周期导致 start 方法里的监听后置导致数据更新不到
    if (repo.selected && this.repoList.length === 1) {
      this.changeSelectedRepos([repo]);
    }
  }

  @action
  private deleteRepo(repo: ISCMRepository) {
    const index = this.repoList.indexOf(repo);
    if (index < 0) {
      this.logger.warn('no such scm repo', repo);
      return;
    }
    this.repoList.splice(index, 1);
  }

  @action
  private changeSelectedRepos(repos: ISCMRepository[]) {
    this.selectedRepos.replace(repos);
    const selectedRepo = repos[0];
    this.selectedRepo = selectedRepo;
    this.onDidSelectedRepoChangeEmitter.fire(selectedRepo);
  }
}
