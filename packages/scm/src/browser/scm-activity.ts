import { Autowired, Injectable } from '@ali/common-di';
import { Event } from '@ali/ide-core-common/lib/event';
import { IDisposable, dispose, combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import { IMainLayoutService } from '@ali/ide-main-layout';

import { SCMService, ISCMRepository, pkgName } from '../common';

// 更新左侧 ActivityBar 中 SCM 模块边的数字
@Injectable()
export class StatusUpdater {
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
      const scmHandler = this.layoutService.getTabbarHandler(pkgName);
      if (scmHandler) {
        scmHandler.setBadge(`${count}`);
      }
    }
  }

  dispose(): void {
    this.disposables = dispose(this.disposables);
  }
}
