import * as React from 'react';
import { observer, useComputed } from 'mobx-react-lite';
import { localize, EDITOR_COMMANDS, useInjectable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService } from '@ali/ide-core-common';
import { ISplice } from '@ali/ide-core-common/lib/sequence';
import * as paths from '@ali/ide-core-common/lib/path';
import { combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import clx from 'classnames';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { ViewState } from '@ali/ide-activity-panel';

import { ISCMRepository, ISCMResourceGroup, SCMService, ISCMResource } from '../common';
import { SCMInput } from './component/scm-input';

import * as styles from './scm.module.less';
import { SCM_CONTEXT_MENU } from './scm-contribution';
import { ViewModelContext, ResourceGroupSplicer } from './scm-model';
import { isSCMResource } from './scm.util';
import { IThemeService } from '../../../theme/src';

const itemLineHeight = 22; // copied from vscode

enum GitActionList {
  openFile = 'editor.openUri',
  gitCommit = 'git.commit',
  gitRefresh = 'git.refresh',
  gitClean = 'git.clean',
  gitCleanAll = 'git.cleanAll',
  gitStage = 'git.stage',
  gitStageAll = 'git.stageAll',
  gitUnstage = 'git.unstage',
  gitUnstageAll = 'git.unstageAll',
  gitOpenResource = 'git.openResource',
}

const repoTreeActionConfig = {
  [GitActionList.openFile]: {
    icon: 'volans_icon open',
    title: 'Open file',
    command: EDITOR_COMMANDS.OPEN_RESOURCE.id,
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitClean]: {
    icon: 'volans_icon withdraw',
    title: 'Discard changes',
    command: 'git.clean',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitCleanAll]: {
    icon: 'volans_icon withdraw',
    title: 'Discard all changes',
    command: 'git.cleanAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStage]: {
    icon: 'volans_icon plus',
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStageAll]: {
    icon: 'volans_icon plus',
    title: 'Stage all changes',
    command: 'git.stageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstage]: {
    icon: 'volans_icon line',
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstageAll]: {
    icon: 'volans_icon line',
    title: 'Unstage all changes',
    command: 'git.unstageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
};

function getRepoGroupActions(groupId: string) {
  if (groupId === 'merge') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'index') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitUnstageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'workingTree') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitCleanAll],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }
}

function getRepoFileActions(groupId: string) {
  const actionList: TreeViewAction[] = [
    repoTreeActionConfig[GitActionList.openFile],
  ];

  if (groupId === 'merge') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'index') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitUnstage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'workingTree') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitClean],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  return actionList;
}

const SCMEmpty = () => {
  return (
    <>
      <div className={styles.noopTip}>
        No source control providers registered.
      </div>
    </>
  );
};

export const SCMHeader: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const [ commitMsg, setCommitMsg ] = React.useState('');

  return (
    <>
      <div className={styles.header}>
        <div>SOURCE CONTROL: GIT</div>
        <div>
          <span
            className={clx('check', 'volans_icon', styles.icon)}
            title={localize('scm.action.git.commit')}
            onClick={() => commandService.executeCommand(GitActionList.gitCommit)}
          />
          <span
            className={clx('refresh', 'volans_icon', styles.icon)}
            title={localize('scm.action.git.refresh')}
            onClick={() => commandService.executeCommand(GitActionList.gitRefresh)}
          />
          <span
            className='fa fa-ellipsis-h'
            title={localize('scm.action.git.more')}
            onClick={() => console.log('should show menu')}
          />
        </div>
      </div>
      <SCMInput
        repository={repository}
        value={commitMsg}
        onChange={(val: string) => setCommitMsg(val)} />
    </>
  );
};

export const SCMRepoTree: React.FC<{
  viewState: ViewState;
  repository: ISCMRepository;
}> = observer(({ viewState, repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const labelService = useInjectable<LabelService>(LabelService);
  const contextMenuRenderer = useInjectable<ContextMenuRenderer>(ContextMenuRenderer);
  const themeService = useInjectable<IThemeService>(IThemeService);

  const viewModel = React.useContext(ViewModelContext);

  React.useEffect(() => {
    const ins = new ResourceGroupSplicer(repository.provider.groups);

    ins.onDidSplice(({ index, deleteCount, elements }) => {
      viewModel.spliceSCMList(index, deleteCount, ...elements);
    });

    return () => {
      ins.dispose();
    };
  }, []);

  const nodes = useComputed(() => {
    return viewModel.scmList.map((item) => {
      if (!isSCMResource(item)) {
        // SCMResourceGroup
        return {
          resourceState: (item as any).toJSON(),
          isFile: false,
          id: item.id,
          name: item.label,
          depth: 0,
          parent: undefined,
          actions: getRepoGroupActions(item.id),
          badge: item.elements.length,
        } as TreeNode;
      }

      const color = item.decorations.color ? themeService.getColor({
        id: item.decorations.color,
      }) : null;

      // SCMResource
      return {
        resourceState: (item as any).toJSON(),
        isFile: true,
        id: item.resourceGroup.id + item.sourceUri,
        name: paths.basename(item.sourceUri.toString()),
        depth: 0,
        parent: undefined,
        actions: getRepoFileActions(item.resourceGroup.id),
        badge: item.decorations.letter,
        icon: labelService.getIcon(URI.from(item.sourceUri)),
        badgeStyle: color ?  { color } : null,
        tooltip: item.decorations.tooltip,
      } as TreeNode;
    });
  }, [ viewModel.scmList ]);

  const commandActuator = React.useCallback((command: string, params?) => {
    return commandService.executeCommand(command, params);
  }, []);

  const handleFileSelect = React.useCallback((files: TreeNode) => {
    const file: TreeNode = files[0];
    if (!file || !file.isFile) {
      return;
    }

    return commandService.executeCommand(GitActionList.gitOpenResource, file.resourceState);
  }, []);

  const onContextMenu = React.useCallback((files, event: React.MouseEvent<HTMLElement>) => {
    const { x, y } = event.nativeEvent;
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    if (file.isFile) {
      const data = { x, y };
      contextMenuRenderer.render(['scm/resourceState/context'], data);
    }
  }, []);

  return (
    <RecycleTree
      nodes={nodes}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      contentNumber={nodes.length}
      scrollContainerStyle={{ width: viewState.width, height: viewState.height }}
      itemLineHeight={itemLineHeight}
      commandActuator={commandActuator}
    />
  );
});

SCMRepoTree.displayName = 'SCMRepoTree';

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
    <div className={styles.wrap}>
      {
        viewModel.repoList.map((repo) => {
          if (!repo.provider || !repo.selected) {
            return null;
          }
          return (
            <div className={styles.scm} key={repo.provider.id}>
              <SCMHeader repository={repo} />
              <SCMRepoTree viewState={props.viewState} repository={repo} />
            </div>
          );
        })
      }
    </div>
  );
});

SCM.displayName = 'SCM';
