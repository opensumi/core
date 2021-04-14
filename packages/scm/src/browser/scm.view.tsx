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
import { SCMHeader } from './components/scm-header.view';
import { SCMResouceList } from './components/scm-resource.view';
import { SCMRepoSelect } from './components/scm-select.view';

import * as styles from './scm.module.less';
import { getSCMRepositoryDesc } from './scm-util';
import { WelcomeView } from '@ali/ide-main-layout/lib/browser/welcome.view';

export const SCMRepoPanel: React.FC<{
  repository: ISCMRepository;
  viewState: ViewState;
}> = observer(({ repository, viewState }) => {
  if (!repository || ! repository.provider) {
    return null;
  }

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

  return (
    <div className={styles.view} ref={$containerRef}>
      <div className={styles.scm}>
        <SCMHeader repository={repository} />
        <SCMResouceList
          width={viewState.width}
          height={viewState.height - 38}
          repository={repository} />
      </div>
    </div>
  );
});

SCMRepoPanel.displayName = 'SCMRepoPanel';

export const SCMResourceView: React.FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  if (!viewModel.selectedRepos.length) {
    return <WelcomeView viewId='scm_view' />;
  }

  const selectedRepo = viewModel.selectedRepos[0];
  return <SCMRepoPanel repository={selectedRepo} viewState={props.viewState} />;
});

SCMResourceView.displayName = 'SCMResourceView';

/**
 * 多 repo 列表
 */
export const SCMProviderList: React.FC<{ viewState: ViewState }> = observer((props) => {
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);
  const selectedRepo = viewModel.selectedRepos[0];

  return (
    <div className={styles.view}>
      {
        viewModel.repoList.length > 1 && (
          <SCMRepoSelect
            viewState={props.viewState}
            repositoryList={viewModel.repoList}
            selectedRepository={selectedRepo} />
        )
      }
    </div>
  );
});

SCMProviderList.displayName = 'SCMProviderList';

export const SCMPanel: React.FC<{ viewState: ViewState }> = observer((props) => {
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
    const scmMenuService = viewModel.getSCMMenuService(selectedRepo);
    if (scmMenuService) {
      return scmMenuService.getTitleMenu();
    }
  }, [ selectedRepo ]);

  // control views
  const views: View[] = React.useMemo(() => {
    const scmProviderViewConfig: View = {
      component: SCMProviderList,
      id: scmProviderViewId,
      name: localize('scm.provider.title'),
      initialProps: { viewState: props.viewState },
    };

    const scmRepoViewConfig: View = {
      component: SCMResourceView,
      id: scmResourceViewId,
      name: repoViewTitle,
      titleMenu: hasMultiRepos && titleMenu || undefined,
      titleMenuContext: selectedRepo && selectedRepo.provider && [selectedRepo.provider],
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

SCMPanel.displayName = 'SCMPanel';
