import { Autowired, Injectable } from '@opensumi/di';
import { StatusBarAlignment, IStatusBarService } from '@opensumi/ide-core-browser/lib/services';
import { localize } from '@opensumi/ide-core-common';
import { Disposable, IDisposable, dispose, combinedDisposable } from '@opensumi/ide-core-common/lib/disposable';
import { Event } from '@opensumi/ide-core-common/lib/event';
import { basename } from '@opensumi/ide-core-common/lib/path';
import { commonPrefixLength } from '@opensumi/ide-core-common/lib/utils/strings';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { SCMService, ISCMRepository, scmContainerId } from '../common';


// 更新 ActivityBar 中 SCM 模块边的数字, 标注当前的 changes 数量
@Injectable()
export class SCMBadgeController {
  private disposables: IDisposable[] = [];

  @Autowired(SCMService)
  private readonly scmService: SCMService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

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
  private readonly scmService: SCMService;

  @Autowired(IStatusBarService)
  private readonly statusbarService: IStatusBarService;

  @Autowired(WorkbenchEditorService)
  private readonly workbenchEditorService: WorkbenchEditorService;

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

    // 监听当前 EditorGroup 的 currentResource 变化以提供多 repo 支持
    this.workbenchEditorService.onActiveResourceChange(this.onDidActiveResouceChange, this, this.disposables);
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

  private onDidActiveResouceChange(): void {
    const currentResource = this.workbenchEditorService.currentResource;

    if (!currentResource || currentResource.uri.scheme !== 'file') {
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
      const prefixLength = commonPrefixLength(rootFSPath, currentResource.uri.codeUri.fsPath);

      if (prefixLength === rootFSPath.length && prefixLength > bestMatchLength) {
        bestRepository = repository;
        bestMatchLength = prefixLength;
      }
    }

    if (bestRepository) {
      this.onDidFocusRepository(bestRepository);
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

    const label = this.getRepoLabel(repository);

    // 注册 statusbar elements
    commands.forEach((c, index) => {
      this.disposables.push(
        this.statusbarService.addElement(`status.scm.repo.${index}`, {
          id: 'status.scm',
          text: c.title,
          name: localize('status-bar.scm'),
          priority: 10000, // copied from vscode
          alignment: StatusBarAlignment.LEFT,
          command: c.id,
          arguments: c.arguments,
          tooltip: `${label} - ${c.tooltip || c.title}`,
        }),
      );
    });
  }

  private getRepoLabel(repository) {
    const label = repository.provider.rootUri
      ? `${basename(repository.provider.rootUri.path)} (${repository.provider.label})`
      : repository.provider.label;

    return label;
  }

  dispose(): void {
    this.focusDisposable.dispose();
    this.disposables = dispose(this.disposables);
  }
}
