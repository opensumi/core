import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-activity-panel';
import { IContextKeyService } from '@ali/ide-core-browser';

import { ISCMRepository, SCMService } from '../common';
import { ViewModelContext } from './scm.store';
import { SCMHeader } from './components/scm-header.view';
import { SCMResouceList } from './components/scm-resource.view';
import { SCMRepoSelect } from './components/scm-select.view';

import * as styles from './scm.module.less';

/**
 * 空视图
 */
const SCMEmpty = () => {
  return (
    <>
      <div className={styles.noop}>
        No source control providers registered.
      </div>
    </>
  );
};

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
  const scmService = useInjectable<SCMService>(SCMService);
  const viewModel = React.useContext(ViewModelContext);

  React.useEffect(() => {
    scmService.onDidAddRepository((repo: ISCMRepository) => {
      viewModel.addRepo(repo);
    });

    scmService.onDidRemoveRepository((repo: ISCMRepository) => {
      viewModel.deleteRepo(repo);
    });

    scmService.onDidChangeSelectedRepositories((repos: ISCMRepository[]) => {
      viewModel.changeSelectedRepos(repos);
    });

    scmService.repositories.forEach((repo) => {
      viewModel.addRepo(repo);
    });
  }, []);

  if (!viewModel.selectedRepos.length) {
    return <SCMEmpty />;
  }

  const selectedRepo = viewModel.selectedRepos[0];

  return <SCMRepoPanel repository={selectedRepo} viewState={props.viewState} />;
});

SCMResourceView.displayName = 'SCMResourceView';

/**
 * 多 repo 列表
 */
export const SCMProviderList: React.FC<{ viewState: ViewState }>  = observer((props) => {
  const viewModel = React.useContext(ViewModelContext);
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
