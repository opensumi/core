import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ViewState } from '@ali/ide-core-browser';
import { localize } from '@ali/ide-core-common';
import { IContextKeyService, View, useInjectable  } from '@ali/ide-core-browser';
import { AccordionContainer } from '@ali/ide-main-layout/lib/browser/accordion/accordion.view';
import { TitleBar } from '@ali/ide-main-layout/lib/browser/accordion/titlebar.view';
import { InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';

import { ISCMRepository, scmProviderViewId, scmResourceViewId, scmContainerId } from '../common';
import { ViewModelContext } from './scm-model';

import { SCMResourceInput } from './components/scm-resource-input';
import { SCMResourceTree } from './components/scm-resource-tree';
import { SCMProviderList } from './components/scm-provider-list';

import * as styles from './scm.module.less';
import { getSCMRepositoryDesc } from './scm-util';
import { WelcomeView } from '@ali/ide-main-layout/lib/browser/welcome.view';

export const SCMResourcesView: React.FC<{
  repository: ISCMRepository;
  viewState: ViewState;
  hasMultiRepos?: boolean;
}> = observer(({ repository, viewState, hasMultiRepos }) => {
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const $containerRef = React.useRef<HTMLDivElement>(null);
  const $that = React.useRef<{ ctx?: IContextKeyService }>({});

  React.useEffect(() => {
    // 挂在 ctx service
    if ($containerRef && $containerRef.current) {
      $that.current.ctx = contextKeyService.createScoped($containerRef.current);
    }
  }, []);

  React.useEffect(() => {
    // 更新 repository 到 scmRepository context key 上去
    if ($that.current.ctx) {
      $that.current.ctx.createKey('scmRepository', repository);
    }
  }, [repository]);

  const extraPaddingTop = hasMultiRepos ? 10 : 0;
  return (
    <div className={styles.view} ref={$containerRef}>
      <div className={styles.scm} style={{paddingTop: extraPaddingTop}}>
        <SCMResourceInput repository={repository} />
        <SCMResourceTree
          width={viewState.width}
          height={viewState.height - 38 - extraPaddingTop} />
      </div>
    </div>
  );
});

SCMResourcesView.displayName = 'SCMResourcesView';

export const SCMResourcesViewWrapper: React.FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  if (!viewModel.selectedRepos.length) {
    return <WelcomeView viewId='scm_view' />;
  }

  const hasMultiRepos = viewModel.repoList.length > 1;
  const selectedRepo = viewModel.selectedRepos[0];

  if (!selectedRepo || ! selectedRepo.provider) {
    return null;
  }

  return <SCMResourcesView
    hasMultiRepos={hasMultiRepos}
    repository={selectedRepo}
    viewState={props.viewState} />;
});

SCMResourcesViewWrapper.displayName = 'SCMResourcesViewWrapper';

/**
 * 多 repo 列表
 */
export const SCMProvidersView: React.FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const selectedRepo = viewModel.selectedRepos[0];

  return (
    <div className={styles.view}>
      {
        viewModel.repoList.length > 1 && (
          <SCMProviderList
            viewState={props.viewState}
            repositoryList={viewModel.repoList}
            selectedRepository={selectedRepo} />
        )
      }
    </div>
  );
});

SCMProvidersView.displayName = 'SCMProvidersView';

export const SCMViewContainer: React.FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  const repoList = viewModel.repoList;
  const hasMultiRepos = viewModel.repoList.length > 1;
  const selectedRepo: ISCMRepository | undefined = viewModel.selectedRepo;

  // title for scm panel
  const panelTitle = React.useMemo(() => {
    return repoList.length === 1 && selectedRepo
      // 将当前 repo 信息写到 scm panel title 中去
      ? `${localize('scm.title')}: ${selectedRepo.provider.label}`
      // 使用默认 scm panel title
      : localize('scm.title');
  }, [ repoList, selectedRepo ]);

  // title for selected repo view
  const repoViewTitle = React.useMemo(() => {
    let repoViewTitle = '';
    if (hasMultiRepos && selectedRepo) {
      const { title, type } = getSCMRepositoryDesc(selectedRepo);
      repoViewTitle = title + '-' + type;
    }
    return repoViewTitle;
  }, [ hasMultiRepos, selectedRepo ]);

  const titleMenu = React.useMemo(() => {
    if (selectedRepo) {
      return viewModel.menus.getRepositoryMenus(selectedRepo?.provider).titleMenu;
    }
  }, [ selectedRepo ]);

  // control views
  const views: View[] = React.useMemo(() => {
    const scmProviderViewConfig: View = {
      component: SCMProvidersView,
      id: scmProviderViewId,
      name: localize('scm.provider.title'),
      initialProps: { viewState: props.viewState },
      priority: 0,
    };

    const scmRepoViewConfig: View = {
      component: SCMResourcesViewWrapper,
      id: scmResourceViewId,
      name: repoViewTitle,
      titleMenu: hasMultiRepos && titleMenu || undefined,
      titleMenuContext: selectedRepo && selectedRepo.provider && [selectedRepo.provider],
      priority: 1,
    };

    return (hasMultiRepos ? [scmProviderViewConfig] : []).concat(scmRepoViewConfig);
  }, [ hasMultiRepos, repoViewTitle, selectedRepo ]);

  return (
    <div className={styles.view}>
      <TitleBar title={panelTitle} menubar={
        !hasMultiRepos && titleMenu
          ? <InlineMenuBar
            menus={titleMenu}
            context={selectedRepo && selectedRepo.provider && [selectedRepo.provider]} />
          : null
      } />
      <AccordionContainer
        views={views}
        noRestore={true}
        containerId={scmContainerId}
        className={styles.scm_accordion}
      />
    </div>
  );
});

SCMViewContainer.displayName = 'SCMViewContainer';
