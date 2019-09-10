import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-activity-panel';

import { ISCMRepository, SCMService } from '../common';
import { ViewModelContext } from './scm.store';
import { SCMHeader } from './components/scm-header.view';
import { SCMResouceList } from './components/scm-resource.view';

import * as styles from './scm.module.less';
import { SCMRepoSelect } from './components/scm-select.view';

const SCMEmpty = () => {
  return (
    <>
      <div className={styles.noop}>
        No source control providers registered.
      </div>
    </>
  );
};

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

export const SCMResourceGroup: React.FC<{ viewState: ViewState }> = observer((props) => {
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

  return (
    <div className={styles.view}>
      {
        selectedRepo && selectedRepo.provider
          && (
            <div className={styles.scm} key={selectedRepo.provider.id}>
              <SCMHeader repository={selectedRepo} />
              <SCMResouceList
                width={props.viewState.width}
                height={props.viewState.height - 30}
                repository={selectedRepo} />
            </div>
          )
      }
    </div>
  );
});

SCMResourceGroup.displayName = 'SCMResourceGroup';
