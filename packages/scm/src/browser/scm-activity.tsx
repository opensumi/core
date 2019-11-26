import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Autowired, Injectable } from '@ali/common-di';
import { Event } from '@ali/ide-core-common/lib/event';
import { Disposable, IDisposable, dispose, combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { basename } from '@ali/ide-core-common/lib/path';
import { IContextKeyService, localize } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { commonPrefixLength } from '@ali/ide-core-common/lib/utils/strings';
import { StatusBarAlignment, IStatusBarService } from '@ali/ide-core-browser/lib/services';
import { Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { AppConfig, ConfigProvider } from '@ali/ide-core-browser';
import { getOctIcon } from '@ali/ide-core-browser';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';

import { SCMService, ISCMRepository, scmResourceViewId, scmContainerId, scmProviderViewId } from '../common';
import { getSCMRepositoryDesc } from './scm-util';
import { SCMMenus } from './scm-menu';
import { ISCMProvider } from '../common';

// 更新 ActivityBar 中 SCM 模块边的数字
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

  public start() {
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

    // 多 repo 时增加当前 repo 信息到 statusbar
    if (this.scmService.repositories.length > 1) {
      // 注册当前 repo 的信息到 statusbar
      this.statusbarService.addElement('status.scm.0', {
        text: label,
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        tooltip: `${localize('scm.statusbar.repo')} - ${label}`,
        iconClass: getOctIcon('repo'),
      });
    }

    // 注册 statusbar elements
    commands.forEach((c, index) => {
      this.statusbarService.addElement(`status.scm.${index + 1}`, {
        text: c.title,
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: c.id,
        arguments: c.arguments,
        tooltip: `${label} - ${c.tooltip}`,
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
  private readonly  scmService: SCMService;

  @Autowired(IMainLayoutService)
  private readonly  layoutService: IMainLayoutService;

  @Autowired(AppConfig)
  private configContext: AppConfig;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  private get viewTitleElement() {
    return document.getElementById('scm-action-container') || undefined;
  }

  private get panelTitleElement() {
    return document.getElementById('scm_container-action-container') || undefined;
  }

  private get $scmPanel() {
    const scmContainer = this.layoutService.getTabbarHandler(scmContainerId);
    return scmContainer;
  }

  public start() {
    this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.disposables);
    this.scmService.onDidChangeSelectedRepositories(this.onDidChangeSelectedRepositories, this, this.disposables);
  }

  public initRender() {
    // 将 toolbar 挂在到 title 上
    this.updateToolbar();
  }

  private onDidAddRepository(repository: ISCMRepository) {
    this.renderPanelTitle();
    this.toggleSCMProviderView();
    if (this.scmService.repositories.length === 1) {
      // 当前只有单个 repo 时，则该 repo 就是选中的 repo
      this.updateToolbar(repository);
    } else {
      this.updateToolbar(this.scmService.selectedRepositories[0]);
    }

    const onDidRemove = Event.filter(this.scmService.onDidRemoveRepository, (e) => e === repository);
    const removeDisposable = onDidRemove((e) => {
      disposable.dispose();
      this.disposables = this.disposables.filter((d) => d !== removeDisposable);
      this.toggleSCMProviderView();
    });

    const disposable = combinedDisposable([removeDisposable]);
    this.disposables.push(disposable);
  }

  private onDidChangeSelectedRepositories(repositories: ISCMRepository[]) {
    this.renderPanelTitle();
    const repository = repositories[0];
    this.updateSCMResourceViewTitle(repository);
    this.updateToolbar(repository);
  }

  private updateToolbar(selectedRepo?: ISCMRepository) {
    if (this.scmService.repositories.length <= 1) {
      this.cleanup(this.viewTitleElement);
      this.renderToolbar(this.panelTitleElement, selectedRepo);
    } else {
      this.cleanup(this.panelTitleElement);
      this.renderToolbar(this.viewTitleElement, selectedRepo);
    }
  }

  // 移除节点内容
  private cleanup(parentNode?: Element) {
    if (parentNode) {
      parentNode.classList.add('p-mod-hidden');
    }
  }

  // 更新 scm resource view title
  private updateSCMResourceViewTitle(selectedRepo: ISCMRepository) {
    if (this.$scmPanel) {
      if (this.scmService.repositories.length > 0) {
        const { title, type } = getSCMRepositoryDesc(selectedRepo);
        this.$scmPanel.updateViewTitle(scmResourceViewId, title + '-' + type);
      } else {
        this.$scmPanel.updateViewTitle(scmResourceViewId, '');
      }
    }
  }

  // 显示/隐藏 scm provider 列表
  private toggleSCMProviderView() {
    if (this.$scmPanel) {
      this.$scmPanel.toggleViews([ scmProviderViewId ], this.scmService.repositories.length > 1);
    }
  }

  // 渲染 panel title
  private renderPanelTitle() {
    if (this.$scmPanel) {
      // 优先使用选中的 repo
      const selectedRepo = this.scmService.selectedRepositories[0];
      const text = this.scmService.repositories.length === 1 && selectedRepo
        ? `${localize('scm.title')}: ${selectedRepo.provider.label}` // 将当前 repo 信息写到 scm panel title 中去
        : localize('scm.title'); // 使用默认 scm panel title

      this.$scmPanel.updateTitle(text);
    }
  }

  // 渲染 toolbar
  private renderToolbar(container?: Element, repository?: ISCMRepository) {
    const provider = repository && repository.provider;
    const titleMenu = this.getSCMTitleToolbar(provider);

    if (container) {
      ReactDOM.render(
        <ConfigProvider value={this.configContext}>
          <InlineActionBar
            menus={titleMenu}
            context={provider && [provider]}
            seperator='navigation' />
        </ConfigProvider>,
        container,
        () => {
          container.classList.remove('p-mod-hidden');
        },
      );
    }
  }

  private getSCMTitleToolbar(provider?: ISCMProvider) {
    const scmMenuService = this.injector.get(SCMMenus, [provider]);
    this.disposables.push(scmMenuService);
    return scmMenuService.getTitleMenu();
  }

  /**
   * hack: 在原有 scm.title 的 element 附近创建 mount 容器节点
   */
  private getSiblingElementById($targetEl: HTMLElement | null, id: string) {
    if ($targetEl && $targetEl.parentNode) {
      let $containerEl = $targetEl.parentNode!.querySelector(`#${id}`);
      if ($containerEl) {
        return $containerEl;
      }

      $containerEl = document.createElement('div');
      $containerEl.classList.add('p-Widget', 'p-TabBar-toolbar');
      $containerEl.id = 'scm_toolbar';
      $targetEl.parentNode.appendChild($containerEl);
      return $containerEl;
    }
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}
