import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ViewState } from '@ali/ide-activity-panel';

import { ISCMRepository, SCMService } from '../common';
import { ViewModelContext } from './scm.store';
import { SCMHeader } from './components/scm-header.view';
import { SCMRepoTree } from './components/scm-tree.view';

import * as styles from './scm.module.less';

const SCMEmpty = () => {
  return (
    <>
      <div className={styles.noop}>
        No source control providers registered.
      </div>
    </>
  );
};

export const SCM = observer((props: { viewState: ViewState }) => {
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

  if (!viewModel.repoList.length) {
    return <SCMEmpty />;
  }

  return (
    <div className={styles.view}>
      {
        viewModel.repoList.map((repo) => {
          if (!repo.provider || !repo.selected) {
            return null;
          }
          return (
            <div className={styles.scm} key={repo.provider.id}>
              <SCMHeader repository={repo} />
              <SCMRepoTree
                width={props.viewState.width}
                height={props.viewState.height - 30}
                repository={repo} />
            </div>
          );
        })
      }
    </div>
  );
});

SCM.displayName = 'SCM';
