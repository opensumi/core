import { observer } from 'mobx-react-lite';
import React, { useEffect, useMemo, useRef, useState, FC, useCallback, memo } from 'react';

import { ViewState } from '@opensumi/ide-core-browser';
import { IContextKeyService, View, useInjectable } from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { IContextMenu, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { DisposableCollection, localize } from '@opensumi/ide-core-common';
import { AccordionContainer } from '@opensumi/ide-main-layout/lib/browser/accordion/accordion.view';
import { TitleBar } from '@opensumi/ide-main-layout/lib/browser/accordion/titlebar.view';
import { WelcomeView } from '@opensumi/ide-main-layout/lib/browser/welcome.view';

import { ISCMRepository, scmProviderViewId, scmResourceViewId, scmContainerId, SCM_WELCOME_ID } from '../common';

import { SCMProviderList } from './components/scm-provider-list';
import { SCMResourceInput } from './components/scm-resource-input';
import { SCMResourceTree } from './components/scm-resource-tree';
import { ViewModelContext } from './scm-model';
import { getSCMRepositoryDesc } from './scm-util';
import styles from './scm.module.less';

const SCM_INPUT_HEIGHT = 38;
const SCM_ACTION_BUTTON_HEIGHT = 38;
const SCM_EXTRA_PADDING_TOP = 10;

export const SCMResourcesView: FC<{
  repository: ISCMRepository;
  viewState: ViewState;
}> = observer(({ repository, viewState }) => {
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const menuRegistry = useInjectable<IMenuRegistry>(IMenuRegistry);
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const $containerRef = useRef<HTMLDivElement>(null);
  const actionButtonMenuDisposables = useRef<DisposableCollection>();
  const $that = useRef<{ ctx?: IContextKeyService }>({});
  const [menus, setMenus] = useState<IContextMenu>();

  useEffect(() => {
    if ($containerRef && $containerRef.current) {
      $that.current.ctx = contextKeyService.createScoped($containerRef.current);
    }
  }, []);

  useEffect(() => {
    // 更新 repository 到 scmRepository context key 上去
    if ($that.current.ctx) {
      // FIXME: 严格的 contextKey 类型不支持使用对象作为 value
      // @ts-ignore
      $that.current.ctx.createKey('scmRepository', repository);
    }
    registerActionButton();
    const disposable = repository.provider.onDidChange(() => {
      registerActionButton();
    });
    return () => {
      disposable.dispose();
    };
  }, [repository]);

  const registerActionButton = useCallback(() => {
    actionButtonMenuDisposables.current?.dispose();
    actionButtonMenuDisposables.current = new DisposableCollection();
    if (!repository.provider.actionButton) {
      return;
    }
    actionButtonMenuDisposables.current.push(
      menuRegistry.registerMenuItem(MenuId.SCMInput, {
        command: {
          id: repository.provider.actionButton.command.id,
          label: repository.provider.actionButton.command.title,
        },
        extraTailArgs: repository.provider.actionButton.command.arguments,
        group: 'navigation',
        type: 'primary',
        enabledWhen: repository.provider.actionButton.enabled ? 'true' : 'false',
      }),
    );
    if (Array.isArray(repository.provider.actionButton.secondaryCommands)) {
      for (let index = 0; index < repository.provider.actionButton.secondaryCommands.length; index++) {
        for (const command of repository.provider.actionButton.secondaryCommands[index]) {
          actionButtonMenuDisposables.current.push(
            menuRegistry.registerMenuItem(MenuId.SCMInput, {
              command: {
                id: command.id,
                label: command.title,
              },
              extraTailArgs: command.arguments,
              group: `${index}_secondary`,
              enabledWhen: repository.provider.actionButton.enabled ? 'true' : 'false',
            }),
          );
        }
      }
    }
    updateActionButton();
  }, [repository, actionButtonMenuDisposables.current]);

  const updateActionButton = useCallback(() => {
    const menus = viewModel.menus.getRepositoryMenus(repository.provider);
    if (menus) {
      setMenus(menus.inputMenu);
    }
  }, [repository, menus]);

  const hasActionButton = repository && repository.provider && menus;
  return (
    <div className={styles.view} ref={$containerRef}>
      <div className={styles.scm} style={{ paddingTop: SCM_EXTRA_PADDING_TOP }}>
        <SCMResourceInput repository={repository} menus={menus} />
        <SCMResourceTree
          width={viewState.width}
          height={
            viewState.height -
            SCM_INPUT_HEIGHT -
            SCM_EXTRA_PADDING_TOP -
            (hasActionButton ? SCM_ACTION_BUTTON_HEIGHT : 0)
          }
        />
      </div>
    </div>
  );
});

SCMResourcesView.displayName = 'SCMResourcesView';

export const SCMResourcesViewWrapper: FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  if (!viewModel.selectedRepos.length) {
    return <WelcomeView viewId={SCM_WELCOME_ID} />;
  }
  const selectedRepo = viewModel.selectedRepos[0];

  if (!selectedRepo || !selectedRepo.provider) {
    return null;
  }

  return <SCMResourcesView repository={selectedRepo} viewState={props.viewState} />;
});

SCMResourcesViewWrapper.displayName = 'SCMResourcesViewWrapper';

/**
 * 多 SCM Repository 列表
 */
export const SCMProvidersView: FC<{ viewState: ViewState; repoList: ISCMRepository[]; selectedRepo?: ISCMRepository }> =
  memo(({ viewState, repoList, selectedRepo }) => (
    <div className={styles.view}>
      {repoList.length > 1 && (
        <SCMProviderList viewState={viewState} repositoryList={repoList} selectedRepository={selectedRepo} />
      )}
    </div>
  ));

SCMProvidersView.displayName = 'SCMProvidersView';

export const SCMViewContainer: FC<{ viewState: ViewState }> = (props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const selectedRepo: ISCMRepository | undefined = viewModel.selectedRepo;

  const [repoList, setRepoList] = useState<ISCMRepository[]>([]);

  const updateRepoList = useCallback(() => {
    setRepoList([...viewModel.repoList]);
  }, [repoList, viewModel]);

  useEffect(() => {
    const disposables = new DisposableCollection();
    disposables.push(viewModel.onDidSCMListChange(updateRepoList));
    disposables.push(viewModel.onDidSCMRepoListChange(updateRepoList));
    return () => {
      disposables.dispose();
    };
  }, [viewModel]);

  const hasMultiRepos = repoList.length > 1;

  // title for scm panel
  const panelTitle = useMemo(
    () =>
      repoList.length === 1 && selectedRepo
        ? // 将当前 repo 信息写到 scm panel title 中去
          `${localize('scm.title')}: ${selectedRepo.provider.label}`
        : // 使用默认 scm panel title
          localize('scm.title'),
    [repoList, selectedRepo],
  );

  // title for selected repo view
  const repoViewTitle = useMemo(() => {
    let repoViewTitle = localize('scm.title');
    if (hasMultiRepos && selectedRepo) {
      const { title, type } = getSCMRepositoryDesc(selectedRepo);
      repoViewTitle = title + '-' + type;
    }
    return repoViewTitle;
  }, [hasMultiRepos, selectedRepo]);

  const titleMenu = useMemo(() => {
    if (selectedRepo) {
      return viewModel.menus.getRepositoryMenus(selectedRepo?.provider).titleMenu;
    }
  }, [selectedRepo]);

  // control views
  const views: View[] = useMemo(() => {
    const scmProviderViewConfig: View = {
      component: SCMProvidersView,
      id: scmProviderViewId,
      name: localize('scm.provider.title'),
      initialProps: { viewState: props.viewState, repoList, selectedRepo },
      priority: 0,
    };

    const scmRepoViewConfig: View = {
      component: SCMResourcesViewWrapper,
      id: scmResourceViewId,
      name: repoViewTitle,
      titleMenu: (hasMultiRepos && titleMenu) || undefined,
      titleMenuContext: selectedRepo && selectedRepo.provider && [selectedRepo.provider],
      priority: 1,
    };

    return (hasMultiRepos ? [scmProviderViewConfig] : []).concat(scmRepoViewConfig);
  }, [hasMultiRepos, repoViewTitle, selectedRepo, repoList]);

  return (
    <div className={styles.view}>
      <TitleBar
        title={panelTitle}
        menubar={
          !hasMultiRepos && titleMenu ? (
            <InlineMenuBar
              menus={titleMenu}
              context={selectedRepo && selectedRepo.provider && [selectedRepo.provider]}
              moreTitle={localize('scm.action.git.more', 'more actions')}
            />
          ) : null
        }
      />
      <AccordionContainer
        views={views}
        containerId={scmContainerId}
        style={{ height: `calc(100% - ${LAYOUT_VIEW_SIZE.PANEL_TITLEBAR_HEIGHT}px)` }}
      />
    </div>
  );
};

SCMViewContainer.displayName = 'SCMViewContainer';
