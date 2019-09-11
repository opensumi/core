import { Autowired, Injectable } from '@ali/common-di';
import { Event } from '@ali/ide-core-common/lib/event';
import { Disposable, IDisposable, dispose, combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { basename } from '@ali/ide-core-common/lib/path';
import { IContextKey, IContextKeyService, localize } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { commonPrefixLength } from '@ali/ide-core-common/lib/utils/strings';
import { StatusBarAlignment, IStatusBarService } from '@ali/ide-core-browser/lib/services';

import { SCMService, ISCMRepository, scmResourceViewId, scmContainerId, scmProviderViewId, scmPanelTitle } from '../common';
import { getSCMRepositoryDesc } from './scm-util';

// 更新左侧 ActivityBar 中 SCM 模块边的数字
@Injectable()
export class SCMBadgeController {
  private disposables: IDisposable[] = [];

  @Autowired(SCMService)
  private scmService: SCMService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  public start() {
    for (const repository of this.scmService.repositories) {
      this.onDidAddRepository(repository);
    }

    this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    this.render();
  }

  private onDidAddRepository(repository: ISCMRepository): void {
    const provider = repository.provider;
    const onDidChange = Event.any(provider.onDidChange, provider.onDidChangeResources);
    const changeDisposable = onDidChange(() => this.render());

    const onDidRemove = Event.filter(this.scmService.onDidRemoveRepository, (e) => e === repository);
    const removeDisposable = onDidRemove(() => {
      disposable.dispose();
      this.disposables = this.disposables.filter((d) => d !== removeDisposable);
      this.render();
    });

    const disposable = combinedDisposable([changeDisposable, removeDisposable]);
    this.disposables.push(disposable);
  }

  private render(): void {
    const count = this.scmService.repositories.reduce((r, repository) => {
      if (typeof repository.provider.count === 'number') {
        return r + repository.provider.count;
      } else {
        return r + repository.provider.groups.elements.reduce<number>((r, g) => r + g.elements.length, 0);
      }
    }, 0);

    if (count > 0) {
      this.setSCMTarbarBadge(`${count}`);
    } else {
      // clear
      this.setSCMTarbarBadge('');
    }
  }

  private setSCMTarbarBadge(badge: string) {
    const scmHandler = this.layoutService.getTabbarHandler(scmContainerId);
    if (scmHandler) {
      scmHandler.setBadge(badge);
    }
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}

// 底部 StatusBar 渲染
@Injectable()
export class SCMStatusBarController {
  @Autowired(SCMService)
  private scmService: SCMService;

  @Autowired(IStatusBarService)
  private statusbarService: IStatusBarService;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(WorkbenchEditorService)
  protected workbenchEditorService: WorkbenchEditorService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  private focusDisposable: IDisposable = Disposable.None;
  private focusedRepository: ISCMRepository | undefined = undefined;
  // private focusedProviderContextKey: IContextKey<string | undefined>;
  private disposables: IDisposable[] = [];

  start() {
    // this.focusedProviderContextKey = this.contextKeyService.createKey<string | undefined>('scmProvider', undefined);
    this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);

    for (const repository of this.scmService.repositories) {
      this.onDidAddRepository(repository);
    }

    // 监听当前 EditorGroup 的 currentResouce 变化以提供多 repo 支持
    this.workbenchEditorService.onActiveResourceChange(() => {
      this.onDidActiveResouceChange();
    });
  }

  private onDidActiveResouceChange(): void {
    const currentResouce = this.workbenchEditorService.currentResource;

    if (!currentResouce || currentResouce.uri.scheme !== 'file') {
      return;
    }

    let bestRepository: ISCMRepository | null = null;
    let bestMatchLength = Number.NEGATIVE_INFINITY;

    for (const repository of this.scmService.repositories) {
      const root = repository.provider.rootUri;

      if (!root) {
        continue;
      }

      const rootFSPath = root.fsPath;
      const prefixLength = commonPrefixLength(rootFSPath, currentResouce.uri.codeUri.fsPath);

      if (prefixLength === rootFSPath.length && prefixLength > bestMatchLength) {
        bestRepository = repository;
        bestMatchLength = prefixLength;
      }
    }

    if (bestRepository) {
      this.onDidFocusRepository(bestRepository);
    }
  }

  private onDidAddRepository(repository: ISCMRepository): void {
    const changeDisposable = repository.onDidFocus(() => this.onDidFocusRepository(repository));
    const onDidRemove = Event.filter(this.scmService.onDidRemoveRepository, (e) => e === repository);
    const removeDisposable = onDidRemove(() => {
      disposable.dispose();
      this.disposables = this.disposables.filter((d) => d !== removeDisposable);

      if (this.scmService.repositories.length === 0) {
        this.onDidFocusRepository(undefined);
      } else if (this.focusedRepository === repository) {
        this.scmService.repositories[0].focus();
      }
    });

    const disposable = combinedDisposable([changeDisposable, removeDisposable]);
    this.disposables.push(disposable);

    if (!this.focusedRepository) {
      this.onDidFocusRepository(repository);
    }
  }

  private onDidFocusRepository(repository: ISCMRepository | undefined): void {
    if (this.focusedRepository === repository) {
      return;
    }

    this.focusedRepository = repository;
    // this.focusedProviderContextKey.set(repository && repository.provider.id);
    this.focusDisposable.dispose();

    if (repository && repository.provider.onDidChangeStatusBarCommands) {
      this.focusDisposable = repository.provider.onDidChangeStatusBarCommands(() => this.render(repository));
    }

    this.render(repository);
  }

  private render(repository: ISCMRepository | undefined): void {
    if (!repository) {
      return;
    }

    const commands = repository.provider.statusBarCommands || [];

    if (!commands.length) {
      return;
    }

    const label = repository.provider.rootUri
      ? `${basename(repository.provider.rootUri.path)} (${repository.provider.label})`
      : repository.provider.label;

    // 注册当前 repo 的信息到 statusbar
    this.statusbarService.addElement('status.scm.0', {
      text: label,
      priority: 10000, // copy from vscode
      alignment: StatusBarAlignment.LEFT,
      tooltip: `${localize('scm.statusbar.repo')} - ${label}`,
      icon: 'repo',
      iconset: 'octicon',
    });

    // 注册 statusbar elements
    commands.forEach((c, index) => {
      this.statusbarService.addElement(`status.scm.${index + 1}`, {
        text: c.title,
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: c.id,
        arguments: c.arguments,
        tooltip: `${label} - ${c.tooltip}`,
        iconset: 'octicon',
      });
    });

    // 刷新 scm/title
    const scmHandler = this.layoutService.getTabbarHandler(scmResourceViewId);
    if (scmHandler) {
      scmHandler.refreshTitle();
    }
  }

  dispose(): void {
    this.focusDisposable.dispose();
    this.disposables = dispose(this.disposables);
  }
}

// 控制 SCMProvider 和 SCMResource 两个 view 的渲染
@Injectable()
export class SCMViewController {
  private disposables: IDisposable[] = [];

  @Autowired(SCMService)
  private scmService: SCMService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  public start() {
    this.toggleSCMResourceView();
    this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    this.scmService.onDidChangeSelectedRepositories(this.onDidChangeSelectedRepositories, this, this.disposables);
  }

  private onDidChangeSelectedRepositories(repositories: ISCMRepository[]) {
    const repository = repositories[0];
    if (this.scmService.repositories.length > 1) {
      this.updateSCMPanelTitle();
    } else {
      this.updateSCMPanelTitle(repository);
    }
    this.updateSCMResourceViewTitle(repository);
    this.refreshPanelViewTitle();
  }

  private onDidAddRepository(repository: ISCMRepository) {
    this.toggleSCMResourceView();

    const onDidRemove = Event.filter(this.scmService.onDidRemoveRepository, (e) => e === repository);
    const removeDisposable = onDidRemove(() => {
      disposable.dispose();
      this.disposables = this.disposables.filter((d) => d !== removeDisposable);
      this.toggleSCMResourceView();
      this.updateSCMResourceViewTitle();
    });

    const disposable = combinedDisposable([removeDisposable]);
    this.disposables.push(disposable);
  }

  /**
   * 根据选中的 repo 信息更新 scm resource view title
   */
  private updateSCMResourceViewTitle(repository?: ISCMRepository) {
    const scmContainer = this.getSCMContainer();
    if (scmContainer) {
      if (repository) {
        const { title, type } = getSCMRepositoryDesc(repository);
        scmContainer.updateViewTitle(scmResourceViewId, title + '-' + type);
      } else {
        scmContainer.updateViewTitle(scmResourceViewId, '');
      }
    }
  }

  /**
   * 根据 repo 信息更新 scm 面板 title
   */
  private updateSCMPanelTitle(repository?: ISCMRepository) {
    const scmContainer = this.getSCMContainer();
    if (scmContainer) {
      if (repository) {
        scmContainer.updateTitle(`${scmPanelTitle}: ${repository.provider.label}`);
      } else {
        scmContainer.updateTitle(scmPanelTitle);
      }
    }
  }

  /**
   * 在更新完 view 之后强制刷新 scm 面板的 title(主要是 actionbars)
   */
  private refreshPanelViewTitle() {
    const scmContainer = this.getSCMContainer();
    if (scmContainer) {
      scmContainer.refreshTitle();
    }
  }

  /**
   * 处理 repo 增删时的 scm provider view 展示/隐藏的问题
   */
  private toggleSCMResourceView() {
    const scmContainer = this.getSCMContainer();
    if (scmContainer) {
      scmContainer.toggleViews([ scmProviderViewId ], this.scmService.repositories.length > 1);
    }
  }

  private getSCMContainer() {
    const scmContainer = this.layoutService.getTabbarHandler(scmContainerId);
    return scmContainer;
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}
