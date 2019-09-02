import { Autowired, Injectable } from '@ali/common-di';
import { Event } from '@ali/ide-core-common/lib/event';
import { Disposable, IDisposable, dispose, combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { basename } from '@ali/ide-core-common/lib/path';
import { IStatusBarService } from '@ali/ide-status-bar';
import { IContextKey, IContextKeyService, getIconClass } from '@ali/ide-core-browser';
import { WorkbenchEditorService } from '@ali/ide-editor';
import { commonPrefixLength } from '@ali/ide-core-common/lib/utils/strings';
import { StatusBarAlignment } from '@ali/ide-status-bar/lib/browser/status-bar.service';

import { SCMService, ISCMRepository, scmViewId } from '../common';

// 更新左侧 ActivityBar 中 SCM 模块边的数字
@Injectable()
export class StatusUpdater {
  private disposables: IDisposable[] = [];

  @Autowired(SCMService)
  private scmService: SCMService;

  @Autowired(IMainLayoutService)
  private layoutService: IMainLayoutService;

  private handlerId: string;

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
      const scmHandler = this.layoutService.getTabbarHandler(scmViewId);
      if (scmHandler) {
        scmHandler.setBadge(`${count}`);
      }
    }
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}

// 底部 StatusBar 渲染
@Injectable()
export class StatusBarController {
  @Autowired(SCMService)
  private scmService: SCMService;

  @Autowired(IStatusBarService)
  private statusbarService: IStatusBarService;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @Autowired(WorkbenchEditorService)
  protected workbenchEditorService: WorkbenchEditorService;

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
      const prefixLength = commonPrefixLength(rootFSPath, currentResouce.uri.toString());

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

    commands.forEach((c, index) => {
      this.statusbarService.addElement('status.scm' + index, {
        text: c.title,
        priority: 10000, // copy from vscode
        alignment: StatusBarAlignment.LEFT,
        command: c.id,
        arguments: c.arguments,
        tooltip: `${label} - ${c.tooltip}`,
        iconset: 'octicon',
      });
    });
  }

  dispose(): void {
    this.focusDisposable.dispose();
    this.disposables = dispose(this.disposables);
  }
}
